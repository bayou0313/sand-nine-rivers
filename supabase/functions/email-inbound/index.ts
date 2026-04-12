import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("Inbound payload:", JSON.stringify(payload));

    const emailData = payload.data || payload;

    // Log full structure to see what fields are available
    console.log("Email data keys:", Object.keys(emailData));
    console.log("Full email data:", JSON.stringify(emailData, null, 2));

    const from = emailData.from || "unknown@unknown.com";

    // Ignore internal emails to prevent forwarding loops
    if (from.includes('@riversand.net') || from.includes('@haulogix.com')) {
      console.log("Skipping internal email from:", from);
      return new Response(JSON.stringify({ skipped: true, reason: "internal sender" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }
    const to = Array.isArray(emailData.to) ? emailData.to.join(", ") : emailData.to || "info@riversand.net";
    const subject = emailData.subject || "(no subject)";

    // Try multiple possible field names for body content
    const htmlContent = emailData.html ||
      emailData.body_html ||
      emailData.htmlBody ||
      emailData.content ||
      (emailData.text ? `<p>${emailData.text}</p>` : null) ||
      (emailData.body ? `<p>${emailData.body}</p>` : null) ||
      '<p>No content</p>';

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "info@riversand.net",
        to: ["cmo@haulogix.com"],
        subject: `FWD [${to}]: ${subject} [from ${from}]`,
        html: `
          <p><strong>To:</strong> ${to}</p>
          <p><strong>From:</strong> ${from}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr>
          ${html}
        `,
        reply_to: from,
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
