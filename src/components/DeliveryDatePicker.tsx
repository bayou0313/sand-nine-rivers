import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays, AlertTriangle } from "lucide-react";

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
  iso: string;          // "2026-03-28"
  dayOfWeek: string;    // "Monday", "Saturday", etc.
};

export type PitSchedule = {
  operating_days: number[] | null; // 0=Sun..6=Sat, null=all days
  saturday_surcharge_override: number | null;
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

export function getAvailableDeliveryDates(pitSchedule?: PitSchedule | null): (DeliveryDate & { blocked?: boolean; blockedReason?: string })[] {
  const centralNow = getCentralTime();
  const centralHour = centralNow.getHours() + centralNow.getMinutes() / 60;
  const today = getCentralDate();
  const todayDay = today.getDay();

  const cutoffHour = parseCutoffHour(pitSchedule?.same_day_cutoff);
  const operatingDays = pitSchedule?.operating_days;
  const hasDaysConfig = operatingDays && operatingDays.length > 0;

  const dates: (DeliveryDate & { blocked?: boolean; blockedReason?: string })[] = [];

  for (let i = 0; dates.length < 7 && i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayOfWeek = d.getDay();

    // Never show Sundays unless PIT explicitly includes Sunday
    if (isSunday(d) && !(hasDaysConfig && operatingDays!.includes(0))) continue;

    const isToday = i === 0;

    // Determine if today qualifies for same-day
    const todayAvailable = todayDay >= 1 && todayDay <= 6 && centralHour < cutoffHour;
    if (isToday && !todayAvailable) continue;
    if (isToday && todayDay === 0 && !(hasDaysConfig && operatingDays!.includes(0))) continue;

    // Check if this day is blocked by PIT operating_days
    const blockedByPit = hasDaysConfig && !operatingDays!.includes(dayOfWeek);

    const entry: DeliveryDate & { blocked?: boolean; blockedReason?: string } = {
      date: d,
      label: formatDayShort(d),
      dateStr: formatDateShort(d),
      fullLabel: formatFull(d),
      isSameDay: isToday,
      isSaturday: isSaturday(d),
      iso: toIso(d),
      dayOfWeek: formatDayOfWeek(d),
    };

    if (blockedByPit) {
      entry.blocked = true;
      entry.blockedReason = "Not available from this location";
    }

    dates.push(entry);
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

export { SATURDAY_SURCHARGE };

type Props = {
  selectedDate: DeliveryDate | null;
  onSelect: (d: DeliveryDate) => void;
  pitSchedule?: PitSchedule | null;
  globalSaturdaySurcharge?: number;
};

const DeliveryDatePicker = ({ selectedDate, onSelect, pitSchedule, globalSaturdaySurcharge }: Props) => {
  const dates = useMemo(() => getAvailableDeliveryDates(pitSchedule), [pitSchedule]);
  const effectiveSatSurcharge = useMemo(() => getEffectiveSaturdaySurcharge(pitSchedule, globalSaturdaySurcharge), [pitSchedule, globalSaturdaySurcharge]);
  const allBlocked = useMemo(() => dates.length === 0 || dates.every(d => d.blocked), [dates]);
  const showCutoffWarning = useMemo(() => {
    if (!selectedDate?.isSameDay) return false;
    return getSameDayCutoffWarning(pitSchedule);
  }, [selectedDate, pitSchedule]);

  return (
    <div className="space-y-4">
      <label className="font-display text-lg text-foreground tracking-wider flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" /> SELECT DELIVERY DATE
      </label>

      {allBlocked ? (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-center">
          <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-2" />
          <p className="font-body text-sm text-amber-800 font-medium">
            No delivery dates available in the next 7 days from this location.
          </p>
          <p className="font-body text-xs text-amber-600 mt-1">
            Call 1-855-GOT-WAYS for scheduling.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {dates.map((d, i) => {
            const isSelected = selectedDate?.iso === d.iso;
            const isBlocked = d.blocked;
            return (
              <motion.button
                key={d.iso}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => !isBlocked && onSelect(d)}
                disabled={isBlocked}
                className={`flex-shrink-0 w-[88px] rounded-xl p-3 text-center border-2 transition-all duration-200 ${
                  isBlocked
                    ? "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                    : isSelected
                    ? "border-accent bg-accent/10 shadow-lg shadow-accent/20 scale-105"
                    : "border-border bg-card hover:border-primary/40 hover:shadow-md"
                }`}
              >
                <p className={`font-display text-sm tracking-wider ${isBlocked ? "text-muted-foreground" : isSelected ? "text-accent" : "text-muted-foreground"}`}>
                  {d.label}
                </p>
                <p className={`font-display text-xl mt-1 ${isBlocked ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {d.dateStr.split(" ")[1]}
                </p>
                <p className={`font-body text-[10px] mt-0.5 ${isBlocked ? "text-muted-foreground" : isSelected ? "text-accent" : "text-muted-foreground"}`}>
                  {d.dateStr.split(" ")[0]}
                </p>
                {isBlocked && (
                  <span className="inline-block mt-1.5 text-[8px] font-display tracking-wider text-muted-foreground">
                    CLOSED
                  </span>
                )}
                {!isBlocked && d.isSameDay && (
                  <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded-full">
                    SAME DAY
                  </span>
                )}
                {!isBlocked && d.isSaturday && (
                  <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded-full">
                    SAT +${effectiveSatSurcharge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {selectedDate?.isSaturday && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="p-3 bg-amber-50 border border-amber-200 rounded-lg"
        >
          <p className="font-body text-sm text-amber-800 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 shrink-0" />
            Saturday delivery — ${effectiveSatSurcharge} surcharge added. Limited spots available.
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
            You're close to the same-day cutoff. We recommend calling 1-855-GOT-WAYS to confirm availability before placing the order.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default DeliveryDatePicker;
