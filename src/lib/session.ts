/**
 * Visitor session management for abandonment tracking.
 * All writes go through the leads-auth edge function (service role)
 * to comply with RLS — anon users cannot UPDATE visitor_sessions directly.
 *
 * NOTRACK MODE: Visit any page with ?notrack=1 to disable tracking for your
 * browser (persists in localStorage). Use ?notrack=0 to re-enable.
 */
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "rsnd_session";
const NOTRACK_KEY = "rsnd_notrack";

/** Call once on app load to check for ?notrack=1 in the URL */
export function checkNoTrack(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("notrack") === "1") {
    localStorage.setItem(NOTRACK_KEY, "1");
    console.info("[session] notrack mode enabled — session tracking disabled");
  } else if (params.get("notrack") === "0") {
    localStorage.removeItem(NOTRACK_KEY);
    console.info("[session] notrack mode disabled — session tracking re-enabled");
  }
}

export function isNoTrack(): boolean {
  return localStorage.getItem(NOTRACK_KEY) === "1";
}

export function getSessionToken(): string {
  let token = localStorage.getItem(SESSION_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, token);
  }
  return token;
}

async function callSessionAction(action: string, payload: Record<string, any>) {
  try {
    await supabase.functions.invoke("leads-auth", {
      body: { action, ...payload },
    });
  } catch (err) {
    console.warn(`[session] ${action} error:`, err);
  }
}

export async function initSession(): Promise<void> {
  if (isNoTrack()) return;
  const token = getSessionToken();
  await callSessionAction("session_init", {
    session_token: token,
    entry_page: window.location.pathname,
    referrer: document.referrer || null,
  });
}

export async function updateSession(
  updates: Record<string, any>
): Promise<void> {
  if (isNoTrack()) return;
  const token = getSessionToken();
  await callSessionAction("session_update", {
    session_token: token,
    updates,
  });
}

export async function getSession(): Promise<any | null> {
  if (isNoTrack()) return null;
  const token = getSessionToken();
  try {
    const { data } = await supabase.rpc("get_own_session" as any, { p_token: token });
    return data;
  } catch {
    return null;
  }
}

export async function incrementVisitCount(): Promise<void> {
  if (isNoTrack()) return;
  const token = getSessionToken();
  try {
    await supabase.rpc("increment_visit_count" as any, { p_token: token });
  } catch (err) {
    console.warn("[session] incrementVisitCount error:", err);
  }
}
