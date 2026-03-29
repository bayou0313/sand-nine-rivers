import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, Search, X, Download, ChevronLeft, ChevronRight } from "lucide-react";

interface Lead {
  id: string;
  created_at: string;
  address: string;
  distance_miles: number | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  contacted: boolean;
}

interface ParsedLead extends Lead {
  state: string;
  zip: string;
}

const PAGE_SIZE = 25;

const parseAddress = (address: string): { state: string; zip: string } => {
  const match = address.match(/,\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?/i);
  if (match) return { state: match[1].toUpperCase(), zip: match[2] };
  const stateOnly = address.match(/,\s*([A-Z]{2})\s*$/i);
  if (stateOnly) return { state: stateOnly[1].toUpperCase(), zip: "—" };
  return { state: "—", zip: "—" };
};

type SortKey = "index" | "created_at" | "address" | "state" | "zip" | "distance_miles" | "customer_name" | "customer_email" | "customer_phone" | "contacted";
type SortDir = "asc" | "desc";

const Leads = () => {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  // Search & filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "contacted" | "not_contacted">("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [distanceFilter, setDistanceFilter] = useState("all");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(1);

  const storedPassword = () => sessionStorage.getItem("leads_pw") || "";

  const fetchLeads = useCallback(async (pw: string) => {
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: pw, action: "list" },
      });
      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
        setAuthenticated(false);
        sessionStorage.removeItem("leads_pw");
        return;
      }
      setLeads(data.leads || []);
      setAuthenticated(true);
      sessionStorage.setItem("leads_pw", pw);
    } catch (err: any) {
      setError(err.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = storedPassword();
    if (saved) fetchLeads(saved);
  }, [fetchLeads]);

  const handleLogin = async () => {
    setError("");
    await fetchLeads(password);
  };

  const toggleContacted = async (id: string) => {
    setToggling(id);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "toggle_contacted", id },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, contacted: data.contacted } : l))
      );
    } catch (err: any) {
      console.error("[toggle]", err);
    } finally {
      setToggling(null);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  // Parsed leads with state/zip
  const parsedLeads: ParsedLead[] = useMemo(
    () => leads.map((l) => ({ ...l, ...parseAddress(l.address) })),
    [leads]
  );

  // Unique states for filter dropdown
  const uniqueStates = useMemo(() => {
    const states = new Set(parsedLeads.map((l) => l.state).filter((s) => s !== "—"));
    return Array.from(states).sort();
  }, [parsedLeads]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return parsedLeads.filter((lead) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const searchable = [lead.address, lead.customer_name, lead.customer_email, lead.customer_phone].filter(Boolean).join(" ").toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      // Status
      if (statusFilter === "contacted" && !lead.contacted) return false;
      if (statusFilter === "not_contacted" && lead.contacted) return false;
      // State
      if (stateFilter !== "all" && lead.state !== stateFilter) return false;
      // Date
      if (dateFilter !== "all") {
        const created = new Date(lead.created_at);
        if (dateFilter === "today" && created < startOfDay) return false;
        if (dateFilter === "week" && created < startOfWeek) return false;
        if (dateFilter === "month" && created < startOfMonth) return false;
        if (dateFilter === "year" && created < startOfYear) return false;
      }
      // Distance
      if (distanceFilter !== "all" && lead.distance_miles != null) {
        const d = Number(lead.distance_miles);
        if (distanceFilter === "30-50" && (d < 30 || d > 50)) return false;
        if (distanceFilter === "50-75" && (d < 50 || d > 75)) return false;
        if (distanceFilter === "75-100" && (d < 75 || d > 100)) return false;
        if (distanceFilter === "100+" && d < 100) return false;
      }
      return true;
    });
  }, [parsedLeads, search, statusFilter, stateFilter, dateFilter, distanceFilter]);

  // Sorted leads
  const sortedLeads = useMemo(() => {
    const sorted = [...filteredLeads].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      let valA: any, valB: any;
      switch (sortKey) {
        case "created_at": valA = a.created_at; valB = b.created_at; break;
        case "address": valA = a.address.toLowerCase(); valB = b.address.toLowerCase(); break;
        case "state": valA = a.state; valB = b.state; break;
        case "zip": valA = a.zip; valB = b.zip; break;
        case "distance_miles": valA = a.distance_miles ?? 9999; valB = b.distance_miles ?? 9999; break;
        case "customer_name": valA = a.customer_name.toLowerCase(); valB = b.customer_name.toLowerCase(); break;
        case "customer_email": valA = (a.customer_email || "").toLowerCase(); valB = (b.customer_email || "").toLowerCase(); break;
        case "customer_phone": valA = a.customer_phone || ""; valB = b.customer_phone || ""; break;
        case "contacted": valA = a.contacted ? 1 : 0; valB = b.contacted ? 1 : 0; break;
        default: valA = 0; valB = 0;
      }
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
    return sorted;
  }, [filteredLeads, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedLeads = sortedLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, statusFilter, stateFilter, dateFilter, distanceFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  };

  // Metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const contacted = parsedLeads.filter((l) => l.contacted).length;
    const thisMonth = parsedLeads.filter((l) => new Date(l.created_at) >= startOfMonth).length;
    const withDist = parsedLeads.filter((l) => l.distance_miles != null);
    const avgDist = withDist.length > 0 ? (withDist.reduce((s, l) => s + Number(l.distance_miles), 0) / withDist.length).toFixed(1) : "—";
    const states = new Set(parsedLeads.map((l) => l.state).filter((s) => s !== "—"));
    const zips = new Set(parsedLeads.map((l) => l.zip).filter((z) => z !== "—"));
    return {
      total: parsedLeads.length,
      notContacted: parsedLeads.length - contacted,
      contacted,
      thisMonth,
      avgDist,
      states: states.size,
      zips: zips.size,
    };
  }, [parsedLeads]);

  // CSV Export
  const exportCsv = () => {
    const headers = ["Lead #", "Date", "Address", "State", "ZIP", "Miles", "Name", "Email", "Phone", "Contacted"];
    const rows = sortedLeads.map((l, i) => [
      i + 1,
      formatDate(l.created_at),
      `"${l.address.replace(/"/g, '""')}"`,
      l.state,
      l.zip,
      l.distance_miles != null ? Number(l.distance_miles).toFixed(1) : "",
      `"${l.customer_name.replace(/"/g, '""')}"`,
      l.customer_email || "",
      l.customer_phone || "",
      l.contacted ? "Yes" : "No",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── LOGIN SCREEN ─────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f4]">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Lock className="w-6 h-6 text-[#0D2137]" />
            <h1 className="text-xl font-bold text-[#0D2137] tracking-wider">DELIVERY LEADS</h1>
          </div>
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="mb-4"
          />
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <Button
            onClick={handleLogin}
            disabled={loading || !password}
            className="w-full bg-[#0D2137] hover:bg-[#0D2137]/90 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
          </Button>
        </div>
      </div>
    );
  }

  // ─── METRIC CARD ──────────────────────────────
  const MetricCard = ({ label, value }: { label: string; value: string | number }) => (
    <div className="bg-[#0D2137] rounded-lg p-3 md:p-4 text-center">
      <p className="text-[#C07A00] text-xl md:text-2xl font-bold">{value}</p>
      <p className="text-white/80 text-[10px] md:text-xs uppercase tracking-wider mt-1">{label}</p>
    </div>
  );

  // ─── COLUMN HEADER ────────────────────────────
  const ColHeader = ({ label, sortField, className = "" }: { label: string; sortField: SortKey; className?: string }) => (
    <th
      onClick={() => handleSort(sortField)}
      className={`px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${className}`}
      style={{ color: sortKey === sortField ? "#C07A00" : "#fff", background: "#0D2137" }}
    >
      {label}{" "}
      <span className="text-[10px] opacity-70">{sortArrow(sortField)}</span>
    </th>
  );

  // ─── SELECT STYLE ─────────────────────────────
  const selectClass = "h-9 rounded-md border border-[#0D2137]/20 bg-white px-2 text-sm text-[#0D2137] focus:outline-none focus:ring-2 focus:ring-[#C07A00]/40";

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f4f4]">
      {/* Header */}
      <header className="bg-[#0D2137] px-4 md:px-6 py-4 flex items-center justify-between">
        <h1 className="text-[#C07A00] font-bold text-lg tracking-widest">DELIVERY LEADS</h1>
        <div className="flex items-center gap-3">
          <span className="text-white/60 text-sm">{leads.length} lead{leads.length !== 1 ? "s" : ""}</span>
          <Button
            onClick={exportCsv}
            variant="outline"
            size="sm"
            className="border-[#C07A00]/50 text-[#C07A00] hover:bg-[#C07A00]/10 text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#0D2137]" />
          </div>
        ) : (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2 md:gap-3">
              <MetricCard label="Total Leads" value={metrics.total} />
              <MetricCard label="Not Contacted" value={metrics.notContacted} />
              <MetricCard label="Contacted" value={metrics.contacted} />
              <MetricCard label="This Month" value={metrics.thisMonth} />
              <MetricCard label="Avg Distance" value={metrics.avgDist === "—" ? "—" : `${metrics.avgDist} mi`} />
              <MetricCard label="States" value={metrics.states} />
              <MetricCard label="ZIP Codes" value={metrics.zips} />
            </div>

            {/* Search + Filters */}
            <div className="flex flex-col md:flex-row gap-2 md:gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-8 h-9"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={selectClass}>
                <option value="all">All leads</option>
                <option value="not_contacted">Not contacted</option>
                <option value="contacted">Contacted</option>
              </select>
              <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={selectClass}>
                <option value="all">All states</option>
                {uniqueStates.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={selectClass}>
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
              </select>
              <select value={distanceFilter} onChange={(e) => setDistanceFilter(e.target.value)} className={selectClass}>
                <option value="all">All distances</option>
                <option value="30-50">30–50 mi</option>
                <option value="50-75">50–75 mi</option>
                <option value="75-100">75–100 mi</option>
                <option value="100+">100+ mi</option>
              </select>
            </div>

            {/* Table */}
            {sortedLeads.length === 0 ? (
              <p className="text-center text-gray-500 py-20">No leads match your filters.</p>
            ) : (
              <>
                <div className="bg-white rounded-xl shadow overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <ColHeader label="#" sortField="index" />
                        <ColHeader label="Date" sortField="created_at" />
                        <ColHeader label="Address" sortField="address" />
                        <ColHeader label="State" sortField="state" />
                        <ColHeader label="ZIP" sortField="zip" />
                        <ColHeader label="Miles" sortField="distance_miles" />
                        <ColHeader label="Name" sortField="customer_name" />
                        <ColHeader label="Email" sortField="customer_email" />
                        <ColHeader label="Phone" sortField="customer_phone" />
                        <ColHeader label="Contacted" sortField="contacted" className="text-center" />
                      </tr>
                    </thead>
                    <tbody>
                      {pagedLeads.map((lead, i) => {
                        const globalIndex = (currentPage - 1) * PAGE_SIZE + i + 1;
                        return (
                          <tr
                            key={lead.id}
                            className="border-b border-gray-100 transition-colors"
                            style={{ background: i % 2 === 0 ? "#fff" : "#F9F9F9" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF8E7")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#F9F9F9")}
                          >
                            <td className="px-3 py-3 text-gray-400 font-mono text-xs">{globalIndex}</td>
                            <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDate(lead.created_at)}</td>
                            <td className="px-3 py-3 text-gray-800 max-w-[220px] truncate" title={lead.address}>{lead.address}</td>
                            <td className="px-3 py-3 text-gray-600 font-medium">{lead.state}</td>
                            <td className="px-3 py-3 text-gray-600">{lead.zip}</td>
                            <td className="px-3 py-3 text-gray-600">{lead.distance_miles != null ? `${Number(lead.distance_miles).toFixed(1)} mi` : "—"}</td>
                            <td className="px-3 py-3 text-gray-800 font-medium">{lead.customer_name}</td>
                            <td className="px-3 py-3 text-gray-600">{lead.customer_email || "—"}</td>
                            <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{lead.customer_phone || "—"}</td>
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={() => toggleContacted(lead.id)}
                                disabled={toggling === lead.id}
                                className="inline-flex"
                                title={lead.contacted ? "Mark as not contacted" : "Mark as contacted"}
                              >
                                {toggling === lead.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                ) : lead.contacted ? (
                                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">Contacted</span>
                                ) : (
                                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">Pending</span>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination & count */}
                <div className="flex items-center justify-between text-sm text-gray-500 px-1">
                  <span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedLeads.length)} of {sortedLeads.length} leads</span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="h-8 px-2"
                      >
                        <ChevronLeft className="w-4 h-4" /> Previous
                      </Button>
                      <span className="text-xs">Page {currentPage} of {totalPages}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="h-8 px-2"
                      >
                        Next <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#0D2137] px-6 py-3 text-center">
        <p className="text-white/40 text-xs">Powered by Haulogix, LLC</p>
      </footer>
    </div>
  );
};

export default Leads;
