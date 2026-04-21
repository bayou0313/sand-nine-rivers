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
  label: string;
  dateStr: string;
  fullLabel: string;
  isSameDay: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  iso: string;
  dayOfWeek: string;
};

export type PitSchedule = {
  operating_days: number[] | null;
  saturday_surcharge_override: number | null;
  sunday_surcharge: number | null;
  same_day_cutoff: string | null;
};

function getCentralTime(): Date {
  const now = new Date();
  const central = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (type: string) => central.find((p) => p.type === type)?.value || "0";
  return new Date(
    parseInt(get("year")), parseInt(get("month")) - 1, parseInt(get("day")),
    parseInt(get("hour")), parseInt(get("minute"))
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
function formatDateShort(d: Date) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function formatDayShort(d: Date) { return d.toLocaleDateString("en-US", { weekday: "short" }); }
function formatFull(d: Date) { return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); }
function formatDayOfWeek(d: Date) { return d.toLocaleDateString("en-US", { weekday: "long" }); }
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

// Date classification states
export type DateState = "available" | "holiday_open" | "booked" | "closed" | "holiday_closed";

export type ClassifiedDate = DeliveryDateWithPit & {
  state: DateState;
  surcharge: number;
  closedReason?: string;
  holidayName?: string;
};

type HolidayRow = {
  holiday_date: string;
  name: string;
  is_closed: boolean;
  surcharge_override: number | null;
  customer_visible: boolean;
};

// Legacy export retained for any external callers — no longer used internally
export function getAvailableDeliveryDates(
  pitSchedule?: PitSchedule | null,
  maxSlots: number = 7,
  _weekendPitMap?: any,
  allPitDistances?: PitDistanceEntry[],
): DeliveryDateWithPit[] {
  const today = getCentralDate();
  const dates: DeliveryDateWithPit[] = [];
  for (let i = 0; dates.length < maxSlots && i < (maxSlots * 2); i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayOfWeek = d.getDay();
    if (allPitDistances && allPitDistances.length > 0) {
      const eligible = allPitDistances.filter(pd => {
        const opDays = pd.pit.operating_days;
        return !opDays || opDays.length === 0 || opDays.includes(dayOfWeek);
      });
      if (eligible.length === 0) continue;
      const serviceable = eligible.filter(pd => pd.serviceable);
      if (serviceable.length > 0) dates.push({
        date: d, label: formatDayShort(d), dateStr: formatDateShort(d), fullLabel: formatFull(d),
        isSameDay: i === 0, isSaturday: isSaturday(d), isSunday: isSunday(d),
        iso: toIso(d), dayOfWeek: formatDayOfWeek(d), assignedPit: serviceable[0],
      });
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
  const isLoadingPitDistances = !!pitId && (!allPitDistances || allPitDistances.length === 0);

  // Fetch holidays for next 60 days
  const [holidays, setHolidays] = useState<Map<string, HolidayRow>>(new Map());
  useEffect(() => {
    const today = getCentralDate();
    const end = new Date(today); end.setDate(today.getDate() + 60);
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("holidays")
          .select("holiday_date,name,is_closed,surcharge_override,customer_visible")
          .gte("holiday_date", toIso(today))
          .lte("holiday_date", toIso(end));
        const m = new Map<string, HolidayRow>();
        (data || []).forEach((h: HolidayRow) => { if (h.customer_visible !== false) m.set(h.holiday_date, h); });
        setHolidays(m);
      } catch { /* silent */ }
    })();
  }, []);

  // STEP 2: Classify ALL 60 days (no filtering)
  const classifiedDates = useMemo<ClassifiedDate[]>(() => {
    console.log("[DDP] classifiedDates run - isLoadingPitDistances:", isLoadingPitDistances);
    console.log("[DDP] classifiedDates run - allPitDistancesLen:", allPitDistances?.length ?? 0);
    console.log("[DDP] classifiedDates run - pitId:", pitId);
    console.log("[DDP] classifiedDates run - holidaysSize:", holidays.size);
    if (isLoadingPitDistances) return [];
    const today = getCentralDate();
    const todayDay = today.getDay();
    const centralHour = getCentralHour();
    const out: ClassifiedDate[] = [];

    for (let i = 0; i < 60; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const dayOfWeek = d.getDay();
      const iso = toIso(d);
      const isToday = i === 0;
      const sat = isSaturday(d);
      const sun = isSunday(d);

      const base: DeliveryDateWithPit = {
        date: d, label: formatDayShort(d), dateStr: formatDateShort(d), fullLabel: formatFull(d),
        isSameDay: isToday, isSaturday: sat, isSunday: sun,
        iso, dayOfWeek: formatDayOfWeek(d),
      };

      const holiday = holidays.get(iso);

      // Find eligible pit for this day-of-week
      let assignedPit: PitDistanceEntry | undefined;
      if (allPitDistances && allPitDistances.length > 0) {
        const eligible = allPitDistances.filter(pd => {
          const opDays = pd.pit.operating_days;
          return !opDays || opDays.length === 0 || opDays.includes(dayOfWeek);
        });
        const serviceable = eligible.filter(pd => pd.serviceable);
        if (serviceable.length > 0) assignedPit = serviceable[0];
      }

      // Surcharge: holiday override > weekend surcharge (never stack)
      let surcharge = 0;
      if (assignedPit) {
        if (sat) {
          surcharge = assignedPit.pit.saturday_surcharge_override
            ?? getEffectiveSaturdaySurcharge(pitSchedule, globalSaturdaySurcharge);
        } else if (sun) {
          surcharge = assignedPit.pit.sunday_surcharge ?? getEffectiveSundaySurcharge(pitSchedule);
        }
      } else if (sat) {
        surcharge = getEffectiveSaturdaySurcharge(pitSchedule, globalSaturdaySurcharge);
      } else if (sun) {
        surcharge = getEffectiveSundaySurcharge(pitSchedule);
      }

      // Holiday classification
      if (holiday) {
        if (holiday.surcharge_override != null) surcharge = holiday.surcharge_override;
        // else: keep weekend surcharge fallback already computed
        if (holiday.is_closed) {
          out.push({ ...base, state: "holiday_closed", surcharge: 0, closedReason: `Closed: ${holiday.name}`, holidayName: holiday.name });
          continue;
        }
        if (!assignedPit) {
          out.push({ ...base, state: "closed", surcharge: 0, closedReason: "No deliveries on this day", holidayName: holiday.name });
          continue;
        }
        // Holiday but open
        out.push({ ...base, state: "holiday_open", surcharge, assignedPit, holidayName: holiday.name });
        continue;
      }

      // No pit serves this day
      if (!assignedPit) {
        const reason = sun ? "No deliveries on Sundays"
          : sat ? "No deliveries on Saturdays"
          : "No deliveries on this day";
        out.push({ ...base, state: "closed", surcharge: 0, closedReason: reason });
        continue;
      }

      // Same-day cutoff
      if (isToday) {
        const pitCutoff = parseCutoffHour(assignedPit.pit.same_day_cutoff);
        const todayAvailable = todayDay >= 1 && todayDay <= 6 && centralHour < pitCutoff;
        if (!todayAvailable) {
          out.push({ ...base, state: "closed", surcharge: 0, closedReason: "Same-day cutoff has passed" });
          continue;
        }
      }

      out.push({ ...base, state: "available", surcharge, assignedPit });
    }
    return out;
  }, [holidays, allPitDistances, pitSchedule, globalSaturdaySurcharge, isLoadingPitDistances]);

  const [datePage, setDatePage] = useState(0);
  const datesPerPage = 6;
  const totalPages = Math.ceil(classifiedDates.length / datesPerPage);

  const [loadData, setLoadData] = useState<LoadCounts | null>(null);

  // STEP: Fetch load counts ONLY for available + holiday_open dates
  useEffect(() => {
    const bookable = classifiedDates.filter(d => d.state === "available" || d.state === "holiday_open");
    if (bookable.length === 0) { setLoadData(null); return; }

    const pitQueries: { pit_id: string; dates: string[] }[] = [];
    for (const d of bookable) {
      const effectivePitId = d.assignedPit?.pit.id || pitId;
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
  }, [pitId, classifiedDates]);

  const isFullyBooked = (d: ClassifiedDate): boolean => {
    if (!loadData) return false;
    if (d.state !== "available" && d.state !== "holiday_open") return false;
    const count = loadData.counts[d.iso] || 0;
    const globalCount = loadData.global_counts[d.iso] || 0;
    if (loadData.max_daily_limit != null && globalCount >= loadData.max_daily_limit) return true;
    if (d.isSaturday && loadData.saturday_load_limit != null && count >= loadData.saturday_load_limit) return true;
    if (d.isSunday && loadData.sunday_load_limit != null && count >= loadData.sunday_load_limit) return true;
    return false;
  };

  // Overlay booked state at render time (keeps classification pure)
  const visibleClassified = useMemo<ClassifiedDate[]>(() =>
    classifiedDates.map(d => isFullyBooked(d) ? { ...d, state: "booked" as DateState, closedReason: "Fully booked for this date." } : d),
    [classifiedDates, loadData]
  );

  const visibleDates = visibleClassified.slice(datePage * datesPerPage, (datePage + 1) * datesPerPage);

  // Surcharge for selected-date banners
  const selectedClassified = selectedDate ? visibleClassified.find(d => d.iso === selectedDate.iso) : undefined;
  const effectiveSatSurcharge = selectedClassified?.surcharge ?? getEffectiveSaturdaySurcharge(pitSchedule, globalSaturdaySurcharge);
  const effectiveSunSurcharge = selectedClassified?.surcharge ?? getEffectiveSundaySurcharge(pitSchedule);

  const showCutoffWarning = useMemo(() => {
    if (!selectedDate?.isSameDay) return false;
    return getSameDayCutoffWarning(pitSchedule);
  }, [selectedDate, pitSchedule]);

  // STEP 3 helper: stateClasses — handles holiday_open in BOTH selected and non-selected branches.
  // Order: blocked-states first → selected variants (per state) → non-selected variants (per state).
  const getStateClasses = (d: ClassifiedDate, isSelected: boolean): string => {
    // Non-clickable states (selection irrelevant)
    if (d.state === "booked") {
      return "border-booked bg-booked-muted opacity-80 cursor-not-allowed";
    }
    if (d.state === "closed") {
      return "border-closed/40 bg-closed-muted opacity-60 cursor-not-allowed";
    }
    if (d.state === "holiday_closed") {
      return "border-holiday/50 bg-holiday-muted opacity-70 cursor-not-allowed";
    }
    // Selected variants — split per state so holiday_open has its own selected style
    if (isSelected) {
      if (d.state === "holiday_open") return "border-holiday bg-holiday-muted shadow-lg shadow-holiday/20 scale-105";
      if (d.isSunday) return "border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-500/20 scale-105";
      if (d.isSaturday) return "border-amber-500 bg-amber-50 shadow-lg shadow-amber-500/20 scale-105";
      return "border-accent bg-accent/10 shadow-lg shadow-accent/20 scale-105";
    }
    // Non-selected available/holiday_open variants
    if (d.state === "holiday_open") return "border-holiday/40 bg-holiday-muted/40 hover:border-holiday hover:shadow-md";
    if (d.isSunday) return "border-indigo-300 bg-indigo-50/60 hover:border-indigo-400 hover:shadow-md";
    if (d.isSaturday) return "border-amber-300 bg-amber-50/60 hover:border-amber-400 hover:shadow-md";
    return "border-border bg-card hover:border-primary/40 hover:shadow-md";
  };

  return (
    <div className="space-y-4">
      {isLoadingPitDistances ? (
        <div className="flex items-center gap-1">
          <div className="flex-shrink-0 w-8 h-8" />
          <div className="flex gap-3 flex-1 justify-center">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[88px] min-h-[96px] rounded-xl border-2 border-border bg-muted/30 animate-pulse" />
            ))}
          </div>
          <div className="flex-shrink-0 w-8 h-8" />
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
                const isClickable = d.state === "available" || d.state === "holiday_open";
                const stateClasses = getStateClasses(d, isSelected);
                return (
                  <motion.button
                    key={d.iso}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => {
                      if (!isClickable) return;
                      onSelect(d);
                      if (d.assignedPit && onPitAssigned) onPitAssigned(d.assignedPit.pit);
                    }}
                    disabled={!isClickable}
                    title={!isClickable ? d.closedReason : undefined}
                    aria-label={!isClickable && d.closedReason ? `${d.fullLabel} — ${d.closedReason}` : d.fullLabel}
                    className={`flex-shrink-0 w-[88px] min-h-[96px] rounded-xl p-3 text-center border-2 transition-all duration-200 ${stateClasses}`}
                  >
                    <p className={`font-display text-sm tracking-wider ${
                      d.state === "booked" ? "text-booked-foreground"
                      : d.state === "closed" ? "text-muted-foreground"
                      : d.state === "holiday_closed" ? "text-holiday-foreground"
                      : isSelected
                        ? (d.state === "holiday_open" ? "text-holiday" : d.isSunday ? "text-indigo-600" : d.isSaturday ? "text-amber-600" : "text-accent")
                        : "text-muted-foreground"
                    }`}>
                      {d.label}
                    </p>
                    <p className={`font-display text-xl mt-1 ${
                      d.state === "closed" || d.state === "holiday_closed" ? "text-muted-foreground line-through"
                      : d.state === "booked" ? "text-booked-foreground"
                      : "text-foreground"
                    }`}>
                      {d.dateStr.split(" ")[1]}
                    </p>
                    <p className={`font-body text-[10px] mt-0.5 ${
                      d.state === "booked" ? "text-booked-foreground"
                      : d.state === "closed" ? "text-muted-foreground"
                      : d.state === "holiday_closed" ? "text-holiday-foreground"
                      : isSelected
                        ? (d.state === "holiday_open" ? "text-holiday" : d.isSunday ? "text-indigo-600" : d.isSaturday ? "text-amber-600" : "text-accent")
                        : "text-muted-foreground"
                    }`}>
                      {d.dateStr.split(" ")[0]}
                    </p>

                    {/* Status badges */}
                    {d.state === "booked" && (
                      <span className="inline-block mt-1.5 text-[8px] font-display tracking-wider bg-booked text-booked-foreground px-1.5 py-0.5 rounded-full">
                        BOOKED
                      </span>
                    )}
                    {d.state === "closed" && (
                      <span className="inline-block mt-1.5 text-[8px] font-display tracking-wider bg-closed/80 text-closed-foreground px-1.5 py-0.5 rounded-full">
                        CLOSED
                      </span>
                    )}
                    {d.state === "holiday_closed" && (
                      <span className="inline-block mt-1.5 text-[8px] font-display tracking-wider bg-holiday text-holiday-foreground px-1.5 py-0.5 rounded-full">
                        HOLIDAY
                      </span>
                    )}
                    {d.state === "holiday_open" && (
                      <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-holiday/15 text-holiday px-1.5 py-0.5 rounded-full">
                        HOLIDAY{d.surcharge > 0 ? ` +$${d.surcharge}` : ""}
                      </span>
                    )}
                    {d.state === "available" && d.isSameDay && (
                      <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded-full">
                        SAME DAY
                      </span>
                    )}
                    {d.state === "available" && !d.isSameDay && d.isSaturday && (
                      <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded-full">
                        SAT +${d.surcharge}
                      </span>
                    )}
                    {d.state === "available" && !d.isSameDay && d.isSunday && d.surcharge > 0 && (
                      <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-indigo-400/20 text-indigo-600 px-1.5 py-0.5 rounded-full">
                        SUN +${d.surcharge}
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
