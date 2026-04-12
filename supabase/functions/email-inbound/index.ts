import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const payload = await req.json();

    const { from, to, subject, html, text } = payload;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "info@riversand.net",
        to: ["cmo@halogix.com"],
        subject: `FWD: ${subject || "No subject"} [from ${from}]`,
        html: html || `<p>${text || "No content"}</p>`,
        reply_to: from,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend error: ${response.statusText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
