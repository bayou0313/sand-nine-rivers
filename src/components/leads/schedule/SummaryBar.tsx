import type { ScheduleSummary } from "@/lib/schedule-adapter";

const BRAND_GOLD = "#C07A00";

interface Props {
  summary: ScheduleSummary;
  dateLabel: string;
}

const cell: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "12px 16px",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#9CA3AF",
};

const numStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1.1,
  color: "#0D2137",
  marginTop: 2,
};

export default function SummaryBar({ summary, dateLabel }: Props) {
  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        overflow: "hidden",
      }}
      role="group"
      aria-label={`Schedule summary for ${dateLabel}`}
    >
      <div style={cell}>
        <div style={labelStyle}>Orders</div>
        <div style={numStyle}>{summary.orders}</div>
      </div>
      <div style={cell}>
        <div style={labelStyle}>Yards</div>
        <div style={numStyle}>{summary.loads}</div>
      </div>
      <div style={cell}>
        <div style={labelStyle}>Revenue</div>
        <div style={{ ...numStyle, color: BRAND_GOLD }}>{fmt(summary.revenue)}</div>
      </div>
      <div style={cell}>
        <div style={labelStyle}>Paid</div>
        <div style={numStyle}>{summary.paid}</div>
      </div>
      <div style={cell}>
        <div style={labelStyle}>Pending</div>
        <div style={numStyle}>{summary.pending}</div>
      </div>
      <div style={cell}>
        <div style={labelStyle}>Missed</div>
        <div style={{ ...numStyle, color: summary.missed > 0 ? "#DC2626" : "#0D2137" }}>
          {summary.missed}
        </div>
      </div>
    </div>
  );
}
