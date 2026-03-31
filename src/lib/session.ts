/**
 * Visitor session management for abandonment tracking.
 * All writes go through the leads-auth edge function (service role)
 * to comply with RLS — anon users cannot UPDATE visitor_sessions directly.
 */
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "rsnd_session";

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
  const token = getSessionToken();
  await callSessionAction("session_init", { session_token: token });
}

export async function updateSession(
  updates: Record<string, any>
): Promise<void> {
  const token = getSessionToken();
  await callSessionAction("session_update", {
    session_token: token,
    updates,
  });
}

export async function getSession(): Promise<any | null> {
  const token = getSessionToken();
  try {
    const { data } = await supabase.rpc("get_own_session" as any, { p_token: token });
    return data;
  } catch {
    return null;
  }
}

export async function incrementVisitCount(): Promise<void> {
  const token = getSessionToken();
  try {
    await supabase.rpc("increment_visit_count" as any, { p_token: token });
  } catch (err) {
    console.warn("[session] incrementVisitCount error:", err);
  }
}
