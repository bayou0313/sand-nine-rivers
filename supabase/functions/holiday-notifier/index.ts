// supabase/functions/holiday-notifier/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;

// Returns YYYY-MM-DD for "today" in America/Chicago
function todayCT(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatHumanDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    timeZone: "UTC",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const today = todayCT();

    // Window boundaries (resilient to cron failures)
    // 10-day window: holiday is 8-10 days out
    // 7-day window: holiday is 5-7 days out
    const tenDayMax = addDays(today, 10);  // furthest date in 10-day window
    const tenDayMin = addDays(today, 8);   // closest date in 10-day window
    const sevenDayMax = addDays(today, 7); // furthest date in 7-day window
    const sevenDayMin = addDays(today, 5); // closest date in 7-day window

    // Recipients from global_settings
    const { data: settingRow } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "notification_recipients")
      .maybeSingle();

    const recipients = (settingRow?.value || "cmo@haulogix.com")
      .split(",").map((s: string) => s.trim()).filter(Boolean);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No recipients configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch any holiday in either window not yet notified for that interval
    const { data: holidays, error } = await supabase
      .from("holidays")
      .select("id, holiday_date, name, confirmation_token, notification_10day_sent, notification_7day_sent")
      .or(
        `and(holiday_date.gte.${tenDayMin},holiday_date.lte.${tenDayMax},notification_10day_sent.eq.false),` +
        `and(holiday_date.gte.${sevenDayMin},holiday_date.lte.${sevenDayMax},notification_7day_sent.eq.false)`
      );

    if (error) throw error;

    const results: Array<{ holiday: string; sent: string; recipients: number }> = [];

    for (const h of holidays || []) {
      const daysOut = Math.round(
        (new Date(h.holiday_date + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime())
        / (1000 * 60 * 60 * 24)
      );

      let sendTenDay = false;
      let sendSevenDay = false;

      if (daysOut >= 8 && daysOut <= 10 && !h.notification_10day_sent) {
        sendTenDay = true;
      } else if (daysOut >= 5 && daysOut <= 7 && !h.notification_7day_sent) {
        sendSevenDay = true;
      }

      if (!sendTenDay && !sendSevenDay) continue;

      const intervalLabel = sendTenDay ? "10-day" : "7-day";
      const displayDays = sendTenDay ? 10 : 7;
      const subject = `Holiday Alert: ${h.name} is in ${displayDays} days — will you be open?`;
      const openUrl = `${FUNCTION_BASE}/holiday-confirm?token=${h.confirmation_token}&decision=open`;
      const closedUrl = `${FUNCTION_BASE}/holiday-confirm?token=${h.confirmation_token}&decision=closed`;
      const humanDate = formatHumanDate(h.holiday_date);

      const emailRes = await fetch(`${FUNCTION_BASE}/send-holiday-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          recipients,
          subject,
          holidayName: h.name,
          holidayDate: humanDate,
          daysOut: displayDays,
          actualDaysOut: daysOut,
          openUrl,
          closedUrl,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error(`[holiday-notifier] email send failed for ${h.name}:`, errText);
        continue; // don't mark as sent — retry tomorrow
      }

      const updateField = sendTenDay
        ? { notification_10day_sent: true, notification_10day_sent_at: new Date().toISOString() }
        : { notification_7day_sent: true, notification_7day_sent_at: new Date().toISOString() };

      await supabase.from("holidays").update(updateField).eq("id", h.id);

      results.push({ holiday: h.name, sent: intervalLabel, recipients: recipients.length });
    }

    return new Response(
      JSON.stringify({ ok: true, today, checked: holidays?.length || 0, sent: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[holiday-notifier] error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
