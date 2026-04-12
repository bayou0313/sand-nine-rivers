import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("Inbound payload:", JSON.stringify(payload));

    // Resend wraps email data inside payload.data
    const emailData = payload.data || payload;
    const from = emailData.from || "unknown@unknown.com";
    const subject = emailData.subject || "(no subject)";
    const html = emailData.html || `<p>${emailData.text || "No content"}</p>`;
    const replyTo = from;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "info@riversand.net",
        to: ["cmo@haulogix.com"],
        subject: `FWD: ${subject} [from ${from}]`,
        html: html,
        reply_to: replyTo,
      }),
    });

    const result = await response.json();
    console.log("Forward result:", JSON.stringify(result));

    if (!response.ok) {
      throw new Error(`Resend error: ${JSON.stringify(result)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("email-inbound error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
