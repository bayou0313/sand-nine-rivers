/**
 * Visitor session management for abandonment tracking.
 * Stores a session token in localStorage and syncs with visitor_sessions table.
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

export async function initSession(): Promise<void> {
  const token = getSessionToken();
  try {
    await (supabase as any)
      .from("visitor_sessions")
      .upsert(
        {
          session_token: token,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "session_token", ignoreDuplicates: false }
      );
  } catch (err) {
    console.warn("[session] initSession error:", err);
  }
}

export async function updateSession(
  updates: Record<string, any>
): Promise<void> {
  const token = getSessionToken();
  try {
    await (supabase as any)
      .from("visitor_sessions")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .eq("session_token", token);
  } catch (err) {
    console.warn("[session] updateSession error:", err);
  }
}

export async function getSession(): Promise<any | null> {
  const token = getSessionToken();
  try {
    const { data } = await (supabase as any)
      .from("visitor_sessions")
      .select("*")
      .eq("session_token", token)
      .single();
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
