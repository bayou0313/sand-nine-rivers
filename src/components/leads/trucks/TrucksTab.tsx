// Trucks tab — live fleet status from SureCam VTS API.
// Calls leads-auth surecam_fleet_status action; auto-refreshes every 60s
// while the browser tab is visible (paused when backgrounded).
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Truck, MapPin, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const POSITIVE = "#059669";
const MUTED = "#6B7280";

interface TruckLocation {
  lat: number;
  lng: number;
  speed_mph: number | null;
  heading: number | null;
  time: string | null;
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

interface Props {
  password: string;
}

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
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        background: online ? "#ECFDF5" : "#F3F4F6",
        color: online ? POSITIVE : MUTED,
      }}
    >
      {state || "unknown"}
    </span>
  );
}

export default function TrucksTab({ password }: Props) {
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const intervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const fetchTrucks = useCallback(
    async (isInitial = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (isInitial) setLoading(true);
      else setRefreshing(true);

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
    },
    [password],
  );

  // Initial load
  useEffect(() => {
    fetchTrucks(true);
  }, [fetchTrucks]);

  // Auto-refresh every 60s, paused when tab backgrounded
  useEffect(() => {
    function startInterval() {
      if (intervalRef.current != null) return;
      intervalRef.current = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchTrucks(false);
        }
      }, REFRESH_MS);
    }
    function stopInterval() {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        // Foreground: refresh immediately + restart interval
        fetchTrucks(false);
        startInterval();
      } else {
        stopInterval();
      }
    }

    if (document.visibilityState === "visible") startInterval();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopInterval();
    };
  }, [fetchTrucks]);

  return (
    <div className="rounded-xl border shadow-sm bg-white" style={{ borderColor: "#E5E7EB" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5" style={{ color: BRAND_NAVY }} />
          <h2
            className="font-display uppercase tracking-wider text-xl"
            style={{ color: BRAND_NAVY }}
          >
            Trucks
          </h2>
          {!loading && trucks.length > 0 && (
            <span style={{ fontSize: 12, color: MUTED }}>
              {trucks.length} device{trucks.length === 1 ? "" : "s"}
              {lastFetchedAt && ` · updated ${formatRelative(lastFetchedAt.toISOString())}`}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchTrucks(false)}
          disabled={refreshing || loading}
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          )}
          Refresh
        </Button>
      </div>

      {/* Body */}
      <div className="p-6">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded animate-pulse"
                style={{ background: "#F3F4F6" }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            style={{ color: MUTED }}
          >
            <AlertTriangle className="w-8 h-8 mb-3" style={{ color: "#DC2626" }} />
            <div className="text-sm font-medium mb-1" style={{ color: BRAND_NAVY }}>
              Failed to load truck status
            </div>
            <div className="text-xs mb-4 max-w-md">{error}</div>
            <Button size="sm" variant="outline" onClick={() => fetchTrucks(true)}>
              Retry
            </Button>
          </div>
        ) : trucks.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            style={{ color: MUTED }}
          >
            <Truck className="w-8 h-8 mb-3" />
            <div className="text-sm">No SureCam devices found</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    background: "#F5F4F1",
                    color: BRAND_NAVY,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <th className="text-left px-3 py-2.5">License Plate</th>
                  <th className="text-left px-3 py-2.5">Driver</th>
                  <th className="text-left px-3 py-2.5">Vehicle</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">Last Seen</th>
                  <th className="text-left px-3 py-2.5">Last Location</th>
                  <th className="text-left px-3 py-2.5">Speed</th>
                </tr>
              </thead>
              <tbody>
                {trucks.map((t, idx) => {
                  const vehicle =
                    [t.vehicle_make, t.vehicle_model].filter(Boolean).join(" ").trim() || "—";
                  const driverDisplay = t.driver_name || "—";
                  const plateDisplay = t.license_plate || t.fleet_number || t.serial;
                  return (
                    <tr
                      key={t.serial}
                      style={{
                        background: idx % 2 === 0 ? "#FFFFFF" : "#F9F9F9",
                        borderTop: "1px solid #F0EFEA",
                      }}
                    >
                      <td className="px-3 py-2.5" style={{ color: BRAND_NAVY, fontWeight: 600 }}>
                        {plateDisplay}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: BRAND_NAVY }}>
                        {driverDisplay}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: MUTED }}>
                        {vehicle}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill state={t.state} />
                      </td>
                      <td className="px-3 py-2.5" style={{ color: MUTED }}>
                        {formatRelative(t.last_connected)}
                      </td>
                      <td className="px-3 py-2.5">
                        {t.last_location ? (
                          <a
                            href={`https://www.google.com/maps?q=${t.last_location.lat},${t.last_location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: BRAND_GOLD,
                              fontWeight: 500,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            {t.last_location.lat.toFixed(4)}, {t.last_location.lng.toFixed(4)}
                          </a>
                        ) : (
                          <span style={{ color: MUTED }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: MUTED }}>
                        {t.last_location?.speed_mph != null
                          ? `${t.last_location.speed_mph.toFixed(1)} mph`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
