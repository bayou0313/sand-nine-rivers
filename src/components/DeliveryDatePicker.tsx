import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarDays, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WAYS_PHONE_DISPLAY } from "@/lib/constants";

const SATURDAY_SURCHARGE = 35;
const CUTOFF_HOUR = 10; // 10:00 AM Central
const TIMEZONE = "America/Chicago";

export type DeliveryDate = {
  date: Date;
  label: string;       // "Mon", "Tue", etc.
  dateStr: string;      // "Mar 28"
  fullLabel: string;    // "Friday, March 28"
  isSameDay: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  iso: string;          // "2026-03-28"
  dayOfWeek: string;    // "Monday", "Saturday", etc.
};

export type PitSchedule = {
  operating_days: number[] | null; // 0=Sun..6=Sat, null=all days
  saturday_surcharge_override: number | null;
  sunday_surcharge: number | null;
  same_day_cutoff: string | null; // "HH:MM" 24hr Central
};

function getCentralTime(): Date {
  const now = new Date();
  const central = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => central.find((p) => p.type === type)?.value || "0";
  return new Date(
    parseInt(get("year")),
    parseInt(get("month")) - 1,
    parseInt(get("day")),
    parseInt(get("hour")),
    parseInt(get("minute"))
  );
}

function getCentralHour(): number {
  const ct = getCentralTime();
  return ct.getHours() + ct.getMinutes() / 60;
}

function getCentralDate(): Date {
  const ct = getCentralTime();
  return new Date(ct.getFullYear(), ct.getMonth(), ct.getDate());
}

function isSunday(d: Date) { return d.getDay() === 0; }
function isSaturday(d: Date) { return d.getDay() === 6; }

function formatDateShort(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function formatDayShort(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}
function formatFull(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function formatDayOfWeek(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long" });
}
function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseCutoffHour(cutoff: string | null | undefined): number {
  if (!cutoff) return CUTOFF_HOUR;
  const parts = cutoff.split(":");
  if (parts.length >= 2) {
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    if (!isNaN(h) && !isNaN(m)) return h + m / 60;
  }
  return CUTOFF_HOUR;
}

export type PitDistanceEntry = {
  pit: {
    id: string;
    name: string;
    operating_days: number[] | null;
    saturday_surcharge_override: number | null;
    sunday_surcharge: number | null;
    same_day_cutoff: string | null;
    [key: string]: any;
  };
  distance: number;
  price: number;
  serviceable: boolean;
};

export type DeliveryDateWithPit = DeliveryDate & {
  blocked?: boolean;
  blockedReason?: string;
  assignedPit?: PitDistanceEntry;
};

export function getAvailableDeliveryDates(
  pitSchedule?: PitSchedule | null,
  maxSlots: number = 7,
  _weekendPitMap?: any, // legacy — ignored
  allPitDistances?: PitDistanceEntry[],
): DeliveryDateWithPit[] {
  const centralNow = getCentralTime();
  const centralHour = centralNow.getHours() + centralNow.getMinutes() / 60;
  const today = getCentralDate();
  const todayDay = today.getDay();

  const cutoffHour = parseCutoffHour(pitSchedule?.same_day_cutoff);

  const dates: DeliveryDateWithPit[] = [];

  for (let i = 0; dates.length < maxSlots && i < (maxSlots * 2); i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayOfWeek = d.getDay();

    // Per-date pit assignment: find closest eligible pit for this day
    if (allPitDistances && allPitDistances.length > 0) {
      const eligible = allPitDistances.filter(pd => {
        const opDays = pd.pit.operating_days;
        return !opDays || opDays.length === 0 || opDays.includes(dayOfWeek);
      });
      // No pit can serve this day → skip entirely (not shown)
      if (eligible.length === 0) continue;
      // Must be serviceable
      const serviceableEligible = eligible.filter(pd => pd.serviceable);
      if (serviceableEligible.length === 0) continue;

      const isToday = i === 0;
      // Use assigned pit's cutoff for same-day check
      const assignedPit = serviceableEligible[0];
      const pitCutoff = parseCutoffHour(assignedPit.pit.same_day_cutoff);
      const todayAvailable = todayDay >= 1 && todayDay <= 6 && centralHour < pitCutoff;
      if (isToday && !todayAvailable) continue;

      const entry: DeliveryDateWithPit = {
        date: d,
        label: formatDayShort(d),
        dateStr: formatDateShort(d),
        fullLabel: formatFull(d),
        isSameDay: isToday,
        isSaturday: isSaturday(d),
        isSunday: isSunday(d),
        iso: toIso(d),
        dayOfWeek: formatDayOfWeek(d),
        assignedPit,
      };
      dates.push(entry);
    } else {
      // Fallback: legacy behavior using pitSchedule
      const operatingDays = pitSchedule?.operating_days;
      const hasDaysConfig = operatingDays && operatingDays.length > 0;

      if (isSunday(d) && !(hasDaysConfig && operatingDays!.includes(0))) continue;
      if (isSaturday(d) && hasDaysConfig && !operatingDays!.includes(6)) continue;

      const isToday = i === 0;
      const todayAvailable = todayDay >= 1 && todayDay <= 6 && centralHour < cutoffHour;
      if (isToday && !todayAvailable) continue;
      if (isToday && todayDay === 0 && !(hasDaysConfig && operatingDays!.includes(0))) continue;

      const blockedByPit = hasDaysConfig && !operatingDays!.includes(dayOfWeek);

      const entry: DeliveryDateWithPit = {
        date: d,
        label: formatDayShort(d),
        dateStr: formatDateShort(d),
        fullLabel: formatFull(d),
        isSameDay: isToday,
        isSaturday: isSaturday(d),
        isSunday: isSunday(d),
        iso: toIso(d),
        dayOfWeek: formatDayOfWeek(d),
      };
      if (blockedByPit) {
        entry.blocked = true;
        entry.blockedReason = "Not available from this location";
      }
      dates.push(entry);
    }
  }

  return dates;
}

export function getSameDayCutoffWarning(pitSchedule?: PitSchedule | null): boolean {
  const hour = getCentralHour();
  const cutoff = parseCutoffHour(pitSchedule?.same_day_cutoff);
  return hour >= (cutoff - 0.5) && hour < cutoff;
}

export function getEffectiveSaturdaySurcharge(pitSchedule?: PitSchedule | null, globalSurcharge?: number): number {
  if (pitSchedule?.saturday_surcharge_override != null) return pitSchedule.saturday_surcharge_override;
  if (globalSurcharge != null) return globalSurcharge;
  return SATURDAY_SURCHARGE;
}

export function getEffectiveSundaySurcharge(pitSchedule?: PitSchedule | null): number {
  return pitSchedule?.sunday_surcharge ?? 0;
}

export { SATURDAY_SURCHARGE };

type LoadCounts = {
  counts: Record<string, number>;
  global_counts: Record<string, number>;
  saturday_load_limit: number | null;
  sunday_load_limit: number | null;
  max_daily_limit: number | null;
};

type Props = {
  selectedDate: DeliveryDate | null;
  onSelect: (d: DeliveryDate) => void;
  onPitAssigned?: (pit: PitDistanceEntry["pit"]) => void;
  pitSchedule?: PitSchedule | null;
  globalSaturdaySurcharge?: number;
  pitId?: string | null;
  allPitDistances?: PitDistanceEntry[];
};

const DeliveryDatePicker = ({ selectedDate, onSelect, onPitAssigned, pitSchedule, globalSaturdaySurcharge, pitId, allPitDistances }: Props) => {
  const dates = useMemo(() => getAvailableDeliveryDates(pitSchedule, 60, null, allPitDistances), [pitSchedule, allPitDistances]);
  const [datePage, setDatePage] = useState(0);
  const datesPerPage = 6;
  const totalPages = Math.ceil(dates.length / datesPerPage);
  const visibleDates = dates.slice(datePage * datesPerPage, (datePage + 1) * datesPerPage);

  // Per-date surcharge helpers
  const getSatSurcharge = (d: DeliveryDateWithPit) => {
    if (d.assignedPit?.pit.saturday_surcharge_override != null) return d.assignedPit.pit.saturday_surcharge_override;
    return getEffectiveSaturdaySurcharge(pitSchedule, globalSaturdaySurcharge);
  };
  const getSunSurcharge = (d: DeliveryDateWithPit) => {
    if (d.assignedPit?.pit.sunday_surcharge != null) return d.assignedPit.pit.sunday_surcharge;
    return getEffectiveSundaySurcharge(pitSchedule);
  };

  // Global surcharges for selected date display
  const effectiveSatSurcharge = selectedDate ? getSatSurcharge(dates.find(dd => dd.iso === selectedDate.iso) || dates[0] || {} as any) : getEffectiveSaturdaySurcharge(pitSchedule, globalSaturdaySurcharge);
  const effectiveSunSurcharge = selectedDate ? getSunSurcharge(dates.find(dd => dd.iso === selectedDate.iso) || dates[0] || {} as any) : getEffectiveSundaySurcharge(pitSchedule);

  const [loadData, setLoadData] = useState<LoadCounts | null>(null);

  // Fetch load counts using per-date assigned pits
  useEffect(() => {
    if (dates.length === 0) { setLoadData(null); return; }

    const pitQueries: { pit_id: string; dates: string[] }[] = [];
    for (const d of dates) {
      const effectivePitId = (d as DeliveryDateWithPit).assignedPit?.pit.id || pitId;
      if (!effectivePitId) continue;
      const existing = pitQueries.find(q => q.pit_id === effectivePitId);
      if (existing) existing.dates.push(d.iso);
      else pitQueries.push({ pit_id: effectivePitId, dates: [d.iso] });
    }
    if (pitQueries.length === 0) { setLoadData(null); return; }

    (async () => {
      try {
        const results = await Promise.all(
          pitQueries.map(q =>
            supabase.functions.invoke("leads-auth", {
              body: { action: "get_date_load_counts", pit_id: q.pit_id, dates: q.dates },
            })
          )
        );
        const merged: LoadCounts = { counts: {}, global_counts: {}, saturday_load_limit: null, sunday_load_limit: null, max_daily_limit: null };
        for (const r of results) {
          if (!r.error && r.data) {
            Object.assign(merged.counts, r.data.counts || {});
            Object.assign(merged.global_counts, r.data.global_counts || {});
            if (r.data.saturday_load_limit != null) merged.saturday_load_limit = r.data.saturday_load_limit;
            if (r.data.sunday_load_limit != null) merged.sunday_load_limit = r.data.sunday_load_limit;
            if (r.data.max_daily_limit != null) merged.max_daily_limit = r.data.max_daily_limit;
          }
        }
        setLoadData(merged);
      } catch { /* silent */ }
    })();
  }, [pitId, dates, allPitDistances]);

  const isFullyBooked = (d: DeliveryDateWithPit) => {
    if (!loadData || d.blocked) return false;
    const count = loadData.counts[d.iso] || 0;
    const globalCount = loadData.global_counts[d.iso] || 0;
    if (loadData.max_daily_limit != null && globalCount >= loadData.max_daily_limit) return true;
    if (d.isSaturday && loadData.saturday_load_limit != null && count >= loadData.saturday_load_limit) return true;
    if (d.isSunday && loadData.sunday_load_limit != null && count >= loadData.sunday_load_limit) return true;
    return false;
  };

  const allBlocked = useMemo(() => dates.length === 0 || dates.every(d => d.blocked || isFullyBooked(d)), [dates, loadData]);

  // Find the next available date beyond the initial 7 when all are blocked
  const [nextAvailable, setNextAvailable] = useState<DeliveryDate | null>(null);
  useEffect(() => {
    if (!allBlocked || !pitId) { setNextAvailable(null); return; }
    // Scan up to 21 days out
    const extended = getAvailableDeliveryDates(pitSchedule, 21, null, allPitDistances);
    // Filter to dates beyond the initial set
    const lastShownIso = dates.length > 0 ? dates[dates.length - 1].iso : "";
    const candidates = extended.filter(d => d.iso > lastShownIso && !d.blocked);
    if (candidates.length === 0) { setNextAvailable(null); return; }

    // Fetch load counts for candidates to check if they're booked
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("leads-auth", {
          body: { action: "get_date_load_counts", pit_id: pitId, dates: candidates.map(c => c.iso) },
        });
        if (!data) { setNextAvailable(candidates[0]); return; }
        const maxDaily = data.max_daily_limit;
        const globalCts = data.global_counts || {};
        const satLimit = data.saturday_load_limit;
        const sunLimit = data.sunday_load_limit;
        const cts = data.counts || {};
        for (const c of candidates) {
          const gc = globalCts[c.iso] || 0;
          const pc = cts[c.iso] || 0;
          if (maxDaily != null && gc >= maxDaily) continue;
          if (c.isSaturday && satLimit != null && pc >= satLimit) continue;
          if (c.isSunday && sunLimit != null && pc >= sunLimit) continue;
          setNextAvailable(c);
          return;
        }
        setNextAvailable(null);
      } catch {
        setNextAvailable(candidates[0]);
      }
    })();
  }, [allBlocked, pitId, pitSchedule, dates]);

  const showCutoffWarning = useMemo(() => {
    if (!selectedDate?.isSameDay) return false;
    return getSameDayCutoffWarning(pitSchedule);
  }, [selectedDate, pitSchedule]);

  return (
    <div className="space-y-4">

      {allBlocked ? (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-center">
          <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-2" />
          <p className="font-body text-sm text-amber-800 font-medium">
            No delivery dates available in the next 7 days from this location.
          </p>
          {nextAvailable ? (
            <button
              type="button"
              onClick={() => { onSelect(nextAvailable); if ((nextAvailable as DeliveryDateWithPit).assignedPit && onPitAssigned) onPitAssigned((nextAvailable as DeliveryDateWithPit).assignedPit!.pit); }}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground font-display text-sm tracking-wider rounded-lg shadow-md hover:shadow-lg hover:bg-accent/90 transition-all"
            >
              <CalendarDays className="w-4 h-4" />
              Next available: {nextAvailable.fullLabel}
            </button>
          ) : (
            <p className="font-body text-xs text-amber-600 mt-1">
              Call {WAYS_PHONE_DISPLAY} for scheduling.
            </p>
          )}
        </div>
      ) : (
        <>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="font-body text-xs" style={{ color: '#6B7280' }}>Select delivery date</span>
          <button
            type="button"
            onClick={() => setDatePage(0)}
            className="font-body text-xs text-accent underline"
          >
            ← Today
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDatePage(p => Math.max(0, p - 1))}
            disabled={datePage === 0}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-3 flex-1 justify-center">
            {visibleDates.map((d, i) => {
              const isSelected = selectedDate?.iso === d.iso;
              const isBlocked = d.blocked || isFullyBooked(d);
              const booked = isFullyBooked(d);
              return (
                <motion.button
                  key={d.iso}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => { if (!isBlocked) { onSelect(d); if ((d as DeliveryDateWithPit).assignedPit && onPitAssigned) onPitAssigned((d as DeliveryDateWithPit).assignedPit!.pit); } }}
                  disabled={isBlocked}
                  className={`flex-shrink-0 w-[88px] min-h-[96px] rounded-xl p-3 text-center border-2 transition-all duration-200 ${
                    isBlocked
                      ? "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                      : isSelected && d.isSunday
                      ? "border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-500/20 scale-105"
                      : isSelected && d.isSaturday
                      ? "border-amber-500 bg-amber-50 shadow-lg shadow-amber-500/20 scale-105"
                      : isSelected
                      ? "border-accent bg-accent/10 shadow-lg shadow-accent/20 scale-105"
                      : d.isSunday
                      ? "border-indigo-300 bg-indigo-50/60 hover:border-indigo-400 hover:shadow-md"
                      : d.isSaturday
                      ? "border-amber-300 bg-amber-50/60 hover:border-amber-400 hover:shadow-md"
                      : "border-border bg-card hover:border-primary/40 hover:shadow-md"
                  }`}
                >
                  <p className={`font-display text-sm tracking-wider ${isBlocked ? "text-muted-foreground" : isSelected ? (d.isSunday ? "text-indigo-600" : d.isSaturday ? "text-amber-600" : "text-accent") : "text-muted-foreground"}`}>
                    {d.label}
                  </p>
                  <p className={`font-display text-xl mt-1 ${isBlocked ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {d.dateStr.split(" ")[1]}
                  </p>
                  <p className={`font-body text-[10px] mt-0.5 ${isBlocked ? "text-muted-foreground" : isSelected ? (d.isSunday ? "text-indigo-600" : d.isSaturday ? "text-amber-600" : "text-accent") : "text-muted-foreground"}`}>
                    {d.dateStr.split(" ")[0]}
                  </p>
                  {booked && (
                    <span className="inline-block mt-1.5 text-[8px] font-display tracking-wider bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                      FULLY BOOKED
                    </span>
                  )}
                  {!isBlocked && d.blocked && (
                    <span className="inline-block mt-1.5 text-[8px] font-display tracking-wider text-muted-foreground">
                      CLOSED
                    </span>
                  )}
                  {!isBlocked && d.isSameDay && (
                    <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded-full">
                      SAME DAY
                    </span>
                  )}
                  {!isBlocked && !booked && d.isSaturday && (
                    <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded-full">
                      SAT +${getSatSurcharge(d)}
                    </span>
                  )}
                  {!isBlocked && !booked && d.isSunday && getSunSurcharge(d) > 0 && (
                    <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-indigo-400/20 text-indigo-600 px-1.5 py-0.5 rounded-full">
                      SUN +${getSunSurcharge(d)}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setDatePage(p => Math.min(totalPages - 1, p + 1))}
            disabled={datePage >= totalPages - 1}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        </>
      )}

      {selectedDate?.isSaturday && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl"
        >
          <p className="font-body text-base font-semibold text-amber-800 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 shrink-0" />
            Saturday delivery — ${effectiveSatSurcharge} surcharge added. Limited spots available.
          </p>
          <p className="font-body text-sm text-amber-700 mt-1 ml-6">
            Card payment required for weekend deliveries.
          </p>
        </motion.div>
      )}

      {selectedDate?.isSunday && effectiveSunSurcharge > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg"
        >
          <p className="font-body text-sm text-indigo-800 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 shrink-0" />
            Sunday delivery — ${effectiveSunSurcharge} surcharge added. Limited spots available.
          </p>
        </motion.div>
      )}

      {selectedDate?.isSameDay && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="p-3 bg-primary/5 border border-primary/20 rounded-lg"
        >
          <p className="font-body text-sm text-muted-foreground">
            Subject to availability — we'll confirm by phone or email.
          </p>
        </motion.div>
      )}

      {showCutoffWarning && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="p-3 bg-amber-50 border border-amber-300 rounded-lg"
        >
          <p className="font-body text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            You're close to the same-day cutoff. We recommend calling {WAYS_PHONE_DISPLAY} to confirm availability before placing the order.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default DeliveryDatePicker;
