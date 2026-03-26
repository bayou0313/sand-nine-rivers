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

export function getAvailableDeliveryDates(): DeliveryDate[] {
  const centralNow = getCentralTime();
  const centralHour = centralNow.getHours() + centralNow.getMinutes() / 60;
  const today = getCentralDate();
  const todayDay = today.getDay(); // 0=Sun, 6=Sat

  const dates: DeliveryDate[] = [];
  let cursor = new Date(today);

  // Determine if today is available
  const todayAvailable =
    todayDay >= 1 && todayDay <= 5 && centralHour < CUTOFF_HOUR;

  for (let i = 0; dates.length < 7 && i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    if (isSunday(d)) continue; // Never show Sundays

    const isToday = i === 0;

    // Skip today if not available
    if (isToday && !todayAvailable) continue;

    // Skip today if it's Saturday or Sunday (Saturday same-day not offered, Sunday never)
    if (isToday && (todayDay === 0 || todayDay === 6)) continue;

    dates.push({
      date: d,
      label: formatDayShort(d),
      dateStr: formatDateShort(d),
      fullLabel: formatFull(d),
      isSameDay: isToday,
      isSaturday: isSaturday(d),
      iso: toIso(d),
      dayOfWeek: formatDayOfWeek(d),
    });
  }

  return dates;
}

export function getSameDayCutoffWarning(): boolean {
  const hour = getCentralHour();
  return hour >= 9.5 && hour < CUTOFF_HOUR;
}

export { SATURDAY_SURCHARGE };

type Props = {
  selectedDate: DeliveryDate | null;
  onSelect: (d: DeliveryDate) => void;
};

const DeliveryDatePicker = ({ selectedDate, onSelect }: Props) => {
  const dates = useMemo(() => getAvailableDeliveryDates(), []);
  const showCutoffWarning = useMemo(() => {
    if (!selectedDate?.isSameDay) return false;
    return getSameDayCutoffWarning();
  }, [selectedDate]);

  return (
    <div className="space-y-4">
      <label className="font-display text-lg text-foreground tracking-wider flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" /> SELECT DELIVERY DATE
      </label>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {dates.map((d, i) => {
          const isSelected = selectedDate?.iso === d.iso;
          return (
            <motion.button
              key={d.iso}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelect(d)}
              className={`flex-shrink-0 w-[88px] rounded-xl p-3 text-center border-2 transition-all duration-200 ${
                isSelected
                  ? "border-accent bg-accent/10 shadow-lg shadow-accent/20 scale-105"
                  : "border-border bg-card hover:border-primary/40 hover:shadow-md"
              }`}
            >
              <p className={`font-display text-sm tracking-wider ${isSelected ? "text-accent" : "text-muted-foreground"}`}>
                {d.label}
              </p>
              <p className={`font-display text-xl mt-1 ${isSelected ? "text-foreground" : "text-foreground"}`}>
                {d.dateStr.split(" ")[1]}
              </p>
              <p className={`font-body text-[10px] mt-0.5 ${isSelected ? "text-accent" : "text-muted-foreground"}`}>
                {d.dateStr.split(" ")[0]}
              </p>
              {d.isSameDay && (
                <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded-full">
                  SAME DAY
                </span>
              )}
              {d.isSaturday && (
                <span className="inline-block mt-1.5 text-[9px] font-display tracking-wider bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded-full">
                  SAT +$35
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {selectedDate?.isSaturday && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="p-3 bg-amber-50 border border-amber-200 rounded-lg"
        >
          <p className="font-body text-sm text-amber-800 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 shrink-0" />
            Saturday delivery — $35 surcharge added. Limited spots available.
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
