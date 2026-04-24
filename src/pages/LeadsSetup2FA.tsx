/**
 * Leads 2FA Setup / Re-enrollment
 * ─────────────────────────────────────────────────────────────────────────
 * Password-gated. Generates a fresh TOTP secret, session signing key, and
 * 10 backup codes. Plaintext secrets shown ONCE — operator must paste both
 * into Lovable Cloud → Secrets before closing the page.
 *
 * RECOVERY PROCEDURE (also documented inline on the /leads login):
 *   1. Open Lovable Cloud → Secrets, delete LEADS_TOTP_SECRET (and optionally
 *      LEADS_SESSION_SIGNING_KEY to invalidate all live sessions).
 *   2. Visit /leads/setup-2fa, enter password.
 *   3. Re-enroll: scan new QR, paste new secrets back into Cloud secrets.
 *   4. Save new backup codes.
 * Test this end-to-end BEFORE depending on 2FA in production.
 */
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#0D2137";
const GOLD = "#C07A00";
const CREAM = "#F7F4EC";
const RED = "#B23A3A";

export default function LeadsSetup2FA() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<null | {
    leads_totp_secret: string;
    leads_session_signing_key: string;
    otpauth_url: string;
    backup_codes: string[];
    instructions: string[];
  }>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data: res, error: invErr } = await supabase.functions.invoke("leads-auth", {
        body: { action: "setup_totp_preview", password },
      });
      if (invErr) throw invErr;
      if (!res?.ok) throw new Error(res?.error || "Enrollment failed");
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: CREAM, padding: "32px 16px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: NAVY, fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 1, margin: 0 }}>
          LEADS — 2FA ENROLLMENT
        </h1>
        <p style={{ color: NAVY, opacity: 0.7, marginTop: 4 }}>
          One-time setup or recovery re-enrollment for the admin dashboard.
        </p>

        {!data && (
          <form onSubmit={handleEnroll} style={card()}>
            <label style={{ color: NAVY, fontWeight: 600, fontSize: 14 }}>
              Admin password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                style={input()}
              />
            </label>
            {error && <div style={errBox()}>{error}</div>}
            <button type="submit" disabled={busy || !password} style={btnPrimary(busy)}>
              {busy ? "Generating…" : "Generate new 2FA secrets"}
            </button>
            <p style={{ color: NAVY, opacity: 0.7, fontSize: 13, marginTop: 12 }}>
              Warning: this wipes all existing backup codes and replaces both server secrets.
              Existing authenticator enrollments will stop working until both new secrets are
              pasted into Lovable Cloud → Secrets.
            </p>
          </form>
        )}

        {data && (
          <>
            <div style={{ ...card(), borderColor: RED, borderWidth: 2 }}>
              <div style={{ color: RED, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                ⚠ SAVE BOTH SECRETS BEFORE CLOSING THIS PAGE
              </div>
              <div style={{ color: NAVY, fontSize: 14 }}>
                Paste both into <strong>Lovable Cloud → Secrets</strong>. They will not be shown again.
                Closing this page without saving them = locked out.
              </div>
            </div>

            <div style={card()}>
              <h2 style={h2()}>1. Server secrets (paste into Lovable Cloud)</h2>
              <SecretRow label="LEADS_TOTP_SECRET" value={data.leads_totp_secret} copied={copied} onCopy={copy} />
              <SecretRow label="LEADS_SESSION_SIGNING_KEY" value={data.leads_session_signing_key} copied={copied} onCopy={copy} />
            </div>

            <div style={card()}>
              <h2 style={h2()}>2. Authenticator app</h2>
              <p style={{ color: NAVY, fontSize: 14, marginTop: 0 }}>
                Scan with Google Authenticator, 1Password, Authy, etc. Or paste the secret above manually.
              </p>
              <div style={{ background: "#fff", padding: 16, display: "inline-block", borderRadius: 8, border: `1px solid ${NAVY}22` }}>
                <QRCodeSVG value={data.otpauth_url} size={200} />
              </div>
            </div>

            <div style={card()}>
              <h2 style={h2()}>3. Backup codes (save these somewhere safe)</h2>
              <p style={{ color: NAVY, fontSize: 14, marginTop: 0 }}>
                Each code works exactly once. Use them if you lose your authenticator.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontFamily: "ui-monospace, monospace" }}>
                {data.backup_codes.map((c) => (
                  <div key={c} style={{ background: CREAM, border: `1px solid ${NAVY}22`, padding: "8px 12px", borderRadius: 6, color: NAVY, fontSize: 14 }}>
                    {c}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => copy("backup", data.backup_codes.join("\n"))}
                style={{ ...btnSecondary(), marginTop: 12 }}
              >
                {copied === "backup" ? "Copied!" : "Copy all 10 codes"}
              </button>
            </div>

            <div style={card()}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", color: NAVY }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span style={{ fontSize: 14 }}>
                  I have saved both server secrets to Lovable Cloud, scanned the QR code,
                  and stored the backup codes somewhere safe.
                </span>
              </label>
              <a
                href="/leads"
                onClick={(e) => { if (!confirmed) e.preventDefault(); }}
                style={{ ...btnPrimary(!confirmed), display: "inline-block", marginTop: 16, textAlign: "center", textDecoration: "none" }}
              >
                {confirmed ? "Go to /leads to test login" : "Confirm above to continue"}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SecretRow({ label, value, copied, onCopy }: { label: string; value: string; copied: string | null; onCopy: (l: string, v: string) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: NAVY, fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <code style={{ flex: 1, background: CREAM, border: `1px solid ${NAVY}22`, padding: "10px 12px", borderRadius: 6, color: NAVY, fontSize: 13, wordBreak: "break-all" }}>
          {value}
        </code>
        <button type="button" onClick={() => onCopy(label, value)} style={btnSecondary()}>
          {copied === label ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const card = (): React.CSSProperties => ({
  background: "#fff", border: `1px solid ${NAVY}22`, borderRadius: 10, padding: 20, marginTop: 16,
});
const h2 = (): React.CSSProperties => ({ color: NAVY, fontSize: 16, margin: "0 0 10px", fontWeight: 700 });
const input = (): React.CSSProperties => ({
  display: "block", width: "100%", marginTop: 6, padding: "10px 12px",
  border: `1px solid ${NAVY}33`, borderRadius: 6, fontSize: 14, color: NAVY, background: "#fff",
});
const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  marginTop: 14, padding: "10px 16px", background: disabled ? "#999" : GOLD, color: "#fff",
  border: "none", borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer",
});
const btnSecondary = (): React.CSSProperties => ({
  padding: "8px 14px", background: NAVY, color: "#fff", border: "none",
  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
});
const errBox = (): React.CSSProperties => ({
  marginTop: 12, padding: "10px 12px", background: "#FBE8E8", color: RED,
  border: `1px solid ${RED}55`, borderRadius: 6, fontSize: 14,
});
