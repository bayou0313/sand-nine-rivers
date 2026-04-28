// Slice D Part 1 — SureCam Live Status, collapsible sub-section.
// Extracted from the previous TrucksTab.tsx so operators don't lose visibility
// during the migration. Uses the existing surecam_fleet_status action unchanged.
// Slice D Part 2 will replace this with a full map view.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, MapPin, AlertTriangle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const POSITIVE = "#059669";
const MUTED = "#6B7280";

interface TruckLocation {
  lat: number; lng: number; speed_mph: number | null; heading: number | null; time: string | null;
}
interface TruckRow {
  serial: string;
  license_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  driver_name: string;
  fleet_number: string;
  state: string;
  last_connected: string | null;
  last_location: TruckLocation | null;
}

interface Props { password: string }

const REFRESH_MS = 60_000;

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, Date.now() - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.floor(day / 30);
  return `${mo} mo${mo === 1 ? "" : "s"} ago`;
}

function StatusPill({ state }: { state: string }) {
  const online = state?.toLowerCase() === "online";
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
      background: online ? "#ECFDF5" : "#F3F4F6",
      color: online ? POSITIVE : MUTED,
    }}>
      {state || "unknown"}
    </span>
  );
}

export default function SureCamLiveStatus({ password }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const intervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const everLoaded = useRef(false);

  const fetchTrucks = useCallback(async (isInitial = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (isInitial) setLoading(true); else setRefreshing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { action: "surecam_fleet_status", password },
      });
      if (fnError) throw new Error(fnError.message || "Edge function error");
      if (data?.error) throw new Error(data.error);
      setTrucks(Array.isArray(data?.trucks) ? data.trucks : []);
      setError(null);
      setLastFetchedAt(new Date());
    } catch (e: any) {
      setError(e?.message || "Failed to load truck status");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [password]);

  // Lazy-load on first expand only
  useEffect(() => {
    if (expanded && !everLoaded.current) {
      everLoaded.current = true;
      fetchTrucks(true);
    }
  }, [expanded, fetchTrucks]);

  // Auto-refresh while expanded + visible
  useEffect(() => {
    function start() {
      if (intervalRef.current != null) return;
      intervalRef.current = window.setInterval(() => {
        if (document.visibilityState === "visible") fetchTrucks(false);
      }, REFRESH_MS);
    }
    function stop() {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    if (expanded && document.visibilityState === "visible") start();
    const onVis = () => {
      if (!expanded) return;
      if (document.visibilityState === "visible") { fetchTrucks(false); start(); }
      else stop();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); stop(); };
  }, [expanded, fetchTrucks]);

  return (
    <div className="rounded-xl border shadow-sm bg-white" style={{ borderColor: "#E5E7EB" }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-6 py-3"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4" style={{ color: BRAND_NAVY }} />
                    : <ChevronRight className="w-4 h-4" style={{ color: BRAND_NAVY }} />}
          <Truck className="w-4 h-4" style={{ color: BRAND_NAVY }} />
          <span className="font-display uppercase tracking-wider text-sm" style={{ color: BRAND_NAVY }}>
            Live Status (SureCam)
          </span>
          {expanded && trucks.length > 0 && !loading && (
            <span className="text-xs" style={{ color: MUTED }}>
              {trucks.length} device{trucks.length === 1 ? "" : "s"}
              {lastFetchedAt && ` · updated ${formatRelative(lastFetchedAt.toISOString())}`}
            </span>
          )}
        </div>
        {expanded && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); fetchTrucks(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); fetchTrucks(false); } }}
            className="inline-flex items-center px-2 py-1 rounded text-xs cursor-pointer hover:bg-secondary"
            style={{ color: BRAND_NAVY, opacity: refreshing || loading ? 0.5 : 1 }}
          >
            {refreshing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Refresh
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-10 rounded animate-pulse" style={{ background: "#F3F4F6" }} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-6 text-center" style={{ color: MUTED }}>
              <AlertTriangle className="w-6 h-6 mb-2" style={{ color: "#DC2626" }} />
              <div className="text-xs mb-3 max-w-md">{error}</div>
              <Button size="sm" variant="outline" onClick={() => fetchTrucks(true)}>Retry</Button>
            </div>
          ) : trucks.length === 0 ? (
            <div className="py-6 text-center text-sm" style={{ color: MUTED }}>No SureCam devices found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{
                    background: "#F5F4F1", color: BRAND_NAVY, fontSize: 10, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    <th className="text-left px-3 py-2">Plate / Fleet</th>
                    <th className="text-left px-3 py-2">Driver</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Last Seen</th>
                    <th className="text-left px-3 py-2">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {trucks.map((t, i) => (
                    <tr key={t.serial} style={{
                      background: i % 2 === 0 ? "#FFFFFF" : "#F9F9F9",
                      borderTop: "1px solid #F0EFEA",
                    }}>
                      <td className="px-3 py-2 font-semibold" style={{ color: BRAND_NAVY }}>
                        {t.license_plate || t.fleet_number || t.serial}
                      </td>
                      <td className="px-3 py-2" style={{ color: BRAND_NAVY }}>{t.driver_name || "—"}</td>
                      <td className="px-3 py-2"><StatusPill state={t.state} /></td>
                      <td className="px-3 py-2" style={{ color: MUTED }}>{formatRelative(t.last_connected)}</td>
                      <td className="px-3 py-2">
                        {t.last_location ? (
                          <a href={`https://www.google.com/maps?q=${t.last_location.lat},${t.last_location.lng}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ color: BRAND_GOLD, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <MapPin className="w-3 h-3" />
                            {t.last_location.lat.toFixed(4)}, {t.last_location.lng.toFixed(4)}
                          </a>
                        ) : <span style={{ color: MUTED }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
