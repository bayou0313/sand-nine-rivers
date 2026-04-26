// Throwaway probe to validate SureCam VTS API access and discover response shape.
// DELETE THIS FUNCTION after verification — it has no place in production.
//
// Reads SURECAM_USERNAME and SURECAM_PASSWORD from environment.
// Hits GET /api/v1/devices with Basic Auth.
// Returns { status, contentType, bodyText, bodyJson? } to the caller.
// Logs only non-sensitive metadata (status code, body length, content type).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const username = Deno.env.get("SURECAM_USERNAME");
  const password = Deno.env.get("SURECAM_PASSWORD");

  if (!username || !password) {
    return new Response(
      JSON.stringify({
        error: "Missing SURECAM_USERNAME or SURECAM_PASSWORD in environment",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const basic = btoa(`${username}:${password}`);
  const url = "https://www.vts.surecam.com/api/v1/devices";

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    console.error("surecam-probe: fetch threw", {
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response(
      JSON.stringify({ error: "Upstream fetch failed" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const bodyText = await upstream.text();

  console.log("surecam-probe: response received", {
    status: upstream.status,
    contentType,
    bodyLength: bodyText.length,
  });

  let bodyJson: unknown = undefined;
  if (contentType.includes("application/json")) {
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      // leave undefined; bodyText still returned
    }
  }

  return new Response(
    JSON.stringify({
      status: upstream.status,
      contentType,
      bodyText,
      bodyJson,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
