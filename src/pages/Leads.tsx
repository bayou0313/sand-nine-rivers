import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Loader2, Search, X, Download, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, MapPin, Send, Settings, Power, Edit2, Save, XCircle, Copy, MessageCircle, ChevronDown, ChevronUp as ChevronUpIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { google: any; }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBDjm1VJ85yJ7KX-cSRX3RCXVir4DOyQ-I";
const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const PAGE_SIZE = 25;
const HQ_LAT = 29.9308;
const HQ_LON = -90.1685;

// Defaults used as fallback if DB fetch fails
const DEFAULT_SETTINGS: Record<string, string> = {
  default_base_price: "195.00",
  default_free_miles: "15",
  default_extra_per_mile: "5.00",
  default_max_distance: "30",
  saturday_surcharge: "35.00",
  site_name: "River Sand",
  phone: "1-855-GOT-WAYS",
};

interface Lead {
  id: string;
  created_at: string;
  address: string;
  distance_miles: number | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  contacted: boolean;
  lead_number: string | null;
  stage: string;
  ip_address: string | null;
  notes: string | null;
  nearest_pit_name: string | null;
  nearest_pit_id: string | null;
  nearest_pit_distance: number | null;
}

interface ParsedLead extends Lead {
  state: string;
  zip: string;
  city: string;
}

interface Pit {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  status: "active" | "planning" | "inactive";
  notes: string;
  is_default?: boolean;
  base_price: number | null;
  free_miles: number | null;
  price_per_extra_mile: number | null;
  max_distance: number | null;
}

interface GlobalSettings {
  [key: string]: string;
}

const getEffectivePrice = (pit: Pit, gs: GlobalSettings) => ({
  base_price: pit.base_price ?? parseFloat(gs.default_base_price || "195"),
  free_miles: pit.free_miles ?? parseFloat(gs.default_free_miles || "15"),
  extra_per_mile: pit.price_per_extra_mile ?? parseFloat(gs.default_extra_per_mile || "5"),
  max_distance: pit.max_distance ?? parseFloat(gs.default_max_distance || "30"),
});

const parseAddress = (address: string): { state: string; zip: string; city: string } => {
  const match = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?/i);
  if (match) return { city: match[1].trim(), state: match[2].toUpperCase(), zip: match[3] };
  const m2 = address.match(/,\s*([A-Z]{2})\s+(\d{5})/i);
  if (m2) return { city: "—", state: m2[1].toUpperCase(), zip: m2[2] };
  return { city: "—", state: "—", zip: "—" };
};

const formatLeadDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return d; }
};

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

type SortKey = "lead_number" | "created_at" | "address" | "state" | "zip" | "distance_miles" | "customer_name" | "customer_email" | "customer_phone" | "contacted" | "stage" | "nearest_pit_name";
type SortDir = "asc" | "desc";

const STAGES = ["new", "called", "quoted", "won", "lost"] as const;
const STAGE_COLORS: Record<string, string> = { new: BRAND_NAVY, called: "#1A6BB8", quoted: "#F59E0B", won: "#22C55E", lost: "#999" };

const Leads = () => {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Detail modal
  const [selectedLead, setSelectedLead] = useState<ParsedLead | null>(null);
  const [detailStage, setDetailStage] = useState("");
  const [detailNote, setDetailNote] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);

  // Global settings
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [editSettings, setEditSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  // PIT simulator — DB-backed
  const [pits, setPits] = useState<Pit[]>([]);
  const [selectedPit, setSelectedPit] = useState<Pit | null>(null);
  const [newPit, setNewPit] = useState({ name: "", address: "", status: "planning" as "active" | "planning" | "inactive", notes: "" });
  const [showAddPit, setShowAddPit] = useState(false);
  const [geocodeCache, setGeocodeCache] = useState<Record<string, { lat: number; lon: number }>>(() => {
    try { return JSON.parse(sessionStorage.getItem("geocache") || "{}"); } catch { return {}; }
  });
  const [geocoding, setGeocoding] = useState(false);
  const [simSelected, setSimSelected] = useState<Set<string>>(new Set());
  const pitInputRef = useRef<HTMLInputElement>(null);

  // PIT edit mode
  const [editingPitId, setEditingPitId] = useState<string | null>(null);
  const [editPitData, setEditPitData] = useState<Partial<Pit>>({});
  const [savingPit, setSavingPit] = useState(false);

  // Bulk proposal modal (PIT sim)
  const [showProposal, setShowProposal] = useState(false);
  const [proposalSubject, setProposalSubject] = useState("");
  const [sendingProposals, setSendingProposals] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  // Quick Proposal Modal
  const [quickProposalLead, setQuickProposalLead] = useState<ParsedLead | null>(null);
  const [qpPitId, setQpPitId] = useState<string>("");
  const [qpPrice, setQpPrice] = useState("");
  const [qpNote, setQpNote] = useState("");
  const [qpSending, setQpSending] = useState(false);
  const [qpShowPreview, setQpShowPreview] = useState(false);

  const storedPassword = () => sessionStorage.getItem("leads_pw") || "";

  const basePrice = parseFloat(globalSettings.default_base_price || "195");

  const fetchLeads = useCallback(async (pw: string) => {
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: pw, action: "list" },
      });
      if (fnError) throw fnError;
      if (data?.error) { setError(data.error); setAuthenticated(false); sessionStorage.removeItem("leads_pw"); return; }
      setLeads(data.leads || []);
      setAuthenticated(true);
      sessionStorage.setItem("leads_pw", pw);
    } catch (err: any) {
      setError(err.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async (pw: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: pw, action: "get_settings" },
      });
      if (fnError) throw fnError;
      if (data?.settings) {
        setGlobalSettings(data.settings);
        setEditSettings(data.settings);
      }
    } catch (err: any) {
      console.error("Failed to fetch settings:", err);
    }
  }, []);

  const fetchPits = useCallback(async (pw: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: pw, action: "list_pits" },
      });
      if (fnError) throw fnError;
      if (data?.pits) setPits(data.pits);
    } catch (err: any) {
      console.error("Failed to fetch pits:", err);
    }
  }, []);

  useEffect(() => {
    const saved = storedPassword();
    if (saved) {
      fetchLeads(saved);
      fetchSettings(saved);
      fetchPits(saved);
    }
  }, [fetchLeads, fetchSettings, fetchPits]);

  const handleLogin = async () => {
    setError("");
    await fetchLeads(password);
    if (sessionStorage.getItem("leads_pw")) {
      await Promise.all([fetchSettings(password), fetchPits(password)]);
    }
  };

  const saveGlobalSettings = async () => {
    setSavingSettings(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "save_settings", settings: editSettings },
      });
      if (fnError) throw fnError;
      if (data?.settings) {
        setGlobalSettings(data.settings);
        setEditSettings(data.settings);
      }
      toast({ title: "Global settings saved — all PITs updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleContacted = async (id: string) => {
    setToggling(id);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "toggle_contacted", id },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, contacted: data.contacted } : l));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const updateStage = async (id: string, stage: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "update_stage", id, stage },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
      toast({ title: "Stage updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const appendNote = async (id: string, note: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "update_notes", id, notes: note },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, notes: data.notes } : l));
      toast({ title: "Note added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Parsed leads
  const parsedLeads = useMemo<ParsedLead[]>(() =>
    leads.map(l => ({ ...l, ...parseAddress(l.address) })),
    [leads]
  );

  // Filters
  const filteredLeads = useMemo(() => {
    const now = new Date();
    return parsedLeads.filter(l => {
      if (search) {
        const s = search.toLowerCase();
        const searchable = `${l.lead_number || ""} ${l.address} ${l.customer_name} ${l.customer_email || ""} ${l.customer_phone || ""}`.toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      if (statusFilter === "contacted" && !l.contacted) return false;
      if (statusFilter === "not_contacted" && l.contacted) return false;
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (stateFilter !== "all" && l.state !== stateFilter) return false;
      if (dateFilter !== "all") {
        const d = new Date(l.created_at);
        if (dateFilter === "today" && d.toDateString() !== now.toDateString()) return false;
        if (dateFilter === "week") { const w = new Date(now); w.setDate(w.getDate() - 7); if (d < w) return false; }
        if (dateFilter === "month" && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
        if (dateFilter === "year" && d.getFullYear() !== now.getFullYear()) return false;
      }
      if (distanceFilter !== "all") {
        const mi = l.distance_miles || 0;
        if (distanceFilter === "30-50" && (mi < 30 || mi > 50)) return false;
        if (distanceFilter === "50-75" && (mi < 50 || mi > 75)) return false;
        if (distanceFilter === "75-100" && (mi < 75 || mi > 100)) return false;
        if (distanceFilter === "100+" && mi < 100) return false;
      }
      return true;
    });
  }, [parsedLeads, search, statusFilter, stageFilter, stateFilter, dateFilter, distanceFilter]);

  // Sort
  const sortedLeads = useMemo(() => {
    const sorted = [...filteredLeads].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const getVal = (l: ParsedLead) => {
        if (sortKey === "distance_miles") return l.distance_miles || 0;
        if (sortKey === "contacted") return l.contacted ? 1 : 0;
        if (sortKey === "lead_number") return l.lead_number || "";
        return (l as any)[sortKey] || "";
      };
      const va = getVal(a), vb = getVal(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return sorted;
  }, [filteredLeads, sortKey, sortDir]);

  const paginatedLeads = useMemo(() => sortedLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sortedLeads, page]);
  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE));

  useEffect(() => { setPage(1); }, [search, statusFilter, stageFilter, stateFilter, dateFilter, distanceFilter]);

  const states = useMemo(() => [...new Set(parsedLeads.map(l => l.state).filter(s => s !== "—"))].sort(), [parsedLeads]);

  // Metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const thisMonth = parsedLeads.filter(l => { const d = new Date(l.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const distances = parsedLeads.filter(l => l.distance_miles).map(l => l.distance_miles!);
    return {
      total: parsedLeads.length,
      notContacted: parsedLeads.filter(l => l.stage === "new").length,
      contacted: parsedLeads.filter(l => l.contacted).length,
      quoted: parsedLeads.filter(l => l.stage === "quoted").length,
      won: parsedLeads.filter(l => l.stage === "won").length,
      thisMonth: thisMonth.length,
      avgDistance: distances.length ? (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1) : "—",
      states: new Set(parsedLeads.map(l => l.state).filter(s => s !== "—")).size,
      zips: new Set(parsedLeads.map(l => l.zip).filter(z => z !== "—")).size,
      pipelineValue: parsedLeads.filter(l => !["won", "lost"].includes(l.stage)).length * basePrice,
    };
  }, [parsedLeads, basePrice]);

  // ZIP intelligence
  const zipData = useMemo(() => {
    const map = new Map<string, ParsedLead[]>();
    parsedLeads.forEach(l => { if (l.zip !== "—") { if (!map.has(l.zip)) map.set(l.zip, []); map.get(l.zip)!.push(l); } });
    return [...map.entries()].map(([zip, leads]) => {
      const avgDist = leads.reduce((s, l) => s + (l.distance_miles || 0), 0) / leads.length;
      const city = leads[0].city;
      const state = leads[0].state;
      const priority = leads.length >= 2 ? "hot" : avgDist <= 75 ? "warm" : "watch";
      return { zip, city, state, count: leads.length, avgDist, priority, leads };
    }).sort((a, b) => b.count - a.count);
  }, [parsedLeads]);

  const maxZipCount = useMemo(() => Math.max(...zipData.map(z => z.count), 1), [zipData]);

  // Export CSV
  const exportCSV = () => {
    const header = ["Lead #", "Date", "Address", "State", "ZIP", "Miles", "Name", "Email", "Phone", "Stage", "Contacted", "IP Address", "Notes"];
    const rows = sortedLeads.map((l, i) => [
      l.lead_number || `#${i + 1}`,
      formatLeadDate(l.created_at),
      `"${l.address}"`,
      l.state, l.zip,
      l.distance_miles?.toFixed(1) || "—",
      `"${l.customer_name}"`,
      l.customer_email || "",
      l.customer_phone || "",
      l.stage,
      l.contacted ? "Yes" : "No",
      l.ip_address || "",
      `"${(l.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Sort handler
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" style={{ color: BRAND_GOLD }} /> : <ArrowDown className="w-3 h-3" style={{ color: BRAND_GOLD }} />;
  };

  // PIT functions
  const geocodeAddress = async (address: string): Promise<{ lat: number; lon: number } | null> => {
    if (geocodeCache[address]) return geocodeCache[address];
    try {
      const resp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await resp.json();
      if (data.results?.[0]) {
        const loc = data.results[0].geometry.location;
        const result = { lat: loc.lat, lon: loc.lng };
        const newCache = { ...geocodeCache, [address]: result };
        setGeocodeCache(newCache);
        sessionStorage.setItem("geocache", JSON.stringify(newCache));
        return result;
      }
    } catch (e) { console.error("Geocode error:", e); }
    return null;
  };

  const addPit = async () => {
    if (!newPit.name || !newPit.address) { toast({ title: "Missing info", description: "Enter PIT name and address", variant: "destructive" }); return; }
    setGeocoding(true);
    const coords = await geocodeAddress(newPit.address);
    if (!coords) { toast({ title: "Geocode failed", description: "Could not find coordinates for that address", variant: "destructive" }); setGeocoding(false); return; }
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: {
          password: storedPassword(),
          action: "save_pit",
          pit: { name: newPit.name, address: newPit.address, lat: coords.lat, lon: coords.lon, status: newPit.status, notes: newPit.notes },
        },
      });
      if (fnError) throw fnError;
      if (data?.pit) setPits(prev => [...prev, data.pit]);
      setNewPit({ name: "", address: "", status: "planning", notes: "" });
      setShowAddPit(false);
      toast({ title: "PIT added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  };

  const deletePit = async (pitId: string) => {
    const pit = pits.find(p => p.id === pitId);
    if (pit?.is_default) {
      toast({ title: "Warning", description: "Deleting the default PIT. Set another PIT as default first.", variant: "destructive" });
    }
    try {
      const { error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "delete_pit", id: pitId },
      });
      if (fnError) throw fnError;
      setPits(prev => prev.filter(p => p.id !== pitId));
      if (selectedPit?.id === pitId) setSelectedPit(null);
      toast({ title: "PIT deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const togglePitStatus = async (pit: Pit) => {
    const newStatus = pit.status === "active" ? "inactive" : "active";
    if (pit.is_default && newStatus === "inactive") {
      toast({ title: "Warning", description: "Deactivating the default PIT will show 'Delivery unavailable' to all customers. Set another PIT as default first." });
    }
    try {
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "save_pit", pit: { ...pit, status: newStatus } },
      });
      if (fnError) throw fnError;
      if (data?.pit) setPits(prev => prev.map(p => p.id === pit.id ? data.pit : p));
      toast({ title: newStatus === "active" ? "PIT activated" : "PIT deactivated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const startEditPit = (pit: Pit) => {
    setEditingPitId(pit.id);
    setEditPitData({ ...pit });
  };

  const cancelEditPit = () => {
    setEditingPitId(null);
    setEditPitData({});
  };

  const saveEditPit = async () => {
    if (!editPitData.name || !editPitData.address) {
      toast({ title: "Missing info", variant: "destructive" });
      return;
    }
    setSavingPit(true);
    try {
      // Geocode if address changed
      const originalPit = pits.find(p => p.id === editingPitId);
      let lat = editPitData.lat!;
      let lon = editPitData.lon!;
      if (originalPit && editPitData.address !== originalPit.address) {
        const coords = await geocodeAddress(editPitData.address!);
        if (!coords) { toast({ title: "Geocode failed", variant: "destructive" }); setSavingPit(false); return; }
        lat = coords.lat;
        lon = coords.lon;
      }
      const pitPayload = {
        id: editingPitId,
        name: editPitData.name,
        address: editPitData.address,
        lat, lon,
        status: editPitData.status,
        notes: editPitData.notes || "",
        is_default: editPitData.is_default,
        base_price: editPitData.base_price || null,
        free_miles: editPitData.free_miles || null,
        price_per_extra_mile: editPitData.price_per_extra_mile || null,
        max_distance: editPitData.max_distance || null,
      };
      const { data, error: fnError } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "save_pit", pit: pitPayload },
      });
      if (fnError) throw fnError;
      if (data?.pit) setPits(prev => prev.map(p => p.id === editingPitId ? data.pit : p));
      setEditingPitId(null);
      setEditPitData({});
      toast({ title: "PIT updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingPit(false);
    }
  };

  // Simulation data
  const simData = useMemo(() => {
    if (!selectedPit) return [];
    const eff = getEffectivePrice(selectedPit, globalSettings);
    return parsedLeads.map(l => {
      const cached = geocodeCache[l.address];
      const hqDist = l.distance_miles || 0;
      if (!cached) return { lead: l, hqDist, pitDist: null, delta: 0, newPrice: 0, status: "unknown" as const };
      const pitDist = haversine(selectedPit.lat, selectedPit.lon, cached.lat, cached.lon);
      const delta = hqDist - pitDist;
      const extra = pitDist > eff.free_miles ? (pitDist - eff.free_miles) * eff.extra_per_mile : 0;
      const newPrice = eff.base_price + extra;
      const status = pitDist <= eff.max_distance ? "serviceable" : pitDist < hqDist ? "closer" : "same";
      return { lead: l, hqDist, pitDist, delta, newPrice, status: status as "serviceable" | "closer" | "same" };
    }).filter(d => d.pitDist !== null).sort((a, b) => (a.pitDist || 0) - (b.pitDist || 0));
  }, [selectedPit, parsedLeads, geocodeCache, globalSettings]);

  const geocodeAllLeads = async () => {
    setGeocoding(true);
    for (const l of parsedLeads) {
      if (!geocodeCache[l.address]) {
        await geocodeAddress(l.address);
        await new Promise(r => setTimeout(r, 200));
      }
    }
    setGeocoding(false);
    toast({ title: "Geocoding complete" });
  };

  // Proposal sending
  const sendProposals = async () => {
    const selected = simData.filter(d => simSelected.has(d.lead.id) && d.lead.customer_email);
    if (selected.length === 0) { toast({ title: "No leads with email selected", variant: "destructive" }); return; }
    setSendingProposals(true);
    setSendProgress({ current: 0, total: selected.length });

    for (let i = 0; i < selected.length; i++) {
      const d = selected[i];
      const { zip } = parseAddress(d.lead.address);
      const orderUrl = `https://riversand.net/order?address=${encodeURIComponent(d.lead.address)}&price=${d.newPrice.toFixed(2)}&zip=${zip}&lead=${encodeURIComponent(d.lead.lead_number || "")}&utm_source=proposal&utm_medium=email&utm_campaign=pit_expansion`;

      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "pit_proposal",
            data: {
              lead_number: d.lead.lead_number,
              customer_name: d.lead.customer_name,
              customer_email: d.lead.customer_email,
              delivery_address: d.lead.address,
              zip_code: zip,
              new_price: d.newPrice.toFixed(2),
              pit_name: selectedPit?.name,
              order_url: orderUrl,
            },
          },
        });
        await updateStage(d.lead.id, "quoted");
        await appendNote(d.lead.id, `Proposal sent from PIT ${selectedPit?.name} at $${d.newPrice.toFixed(2)}. Order link: ${orderUrl}`);
      } catch (err: any) {
        console.error("Proposal send error:", err);
      }
      setSendProgress({ current: i + 1, total: selected.length });
    }

    setSendingProposals(false);
    setShowProposal(false);
    setSimSelected(new Set());
    toast({ title: `${selected.length} proposals sent` });
    await fetchLeads(storedPassword());
  };

  // Quick Proposal functions
  const openQuickProposal = (lead: ParsedLead) => {
    setQuickProposalLead(lead);
    const defaultPitId = lead.nearest_pit_id || pits.find(p => p.is_default)?.id || "";
    setQpPitId(defaultPitId);
    // Calculate price for default PIT
    const pit = pits.find(p => p.id === defaultPitId);
    if (pit && lead.nearest_pit_distance != null) {
      const eff = getEffectivePrice(pit, globalSettings);
      const dist = lead.nearest_pit_distance;
      const extra = dist > eff.free_miles ? (dist - eff.free_miles) * eff.extra_per_mile : 0;
      setQpPrice((eff.base_price + extra).toFixed(2));
    } else {
      setQpPrice(basePrice.toFixed(2));
    }
    setQpNote("");
    setQpShowPreview(false);
  };

  const qpSelectedPit = useMemo(() => pits.find(p => p.id === qpPitId), [pits, qpPitId]);

  const qpDistance = useMemo(() => {
    if (!quickProposalLead || !qpSelectedPit) return null;
    // If this is the same as nearest_pit, use stored distance
    if (quickProposalLead.nearest_pit_id === qpPitId && quickProposalLead.nearest_pit_distance != null) {
      return quickProposalLead.nearest_pit_distance;
    }
    // Otherwise calculate from geocache
    const cached = geocodeCache[quickProposalLead.address];
    if (!cached) return null;
    return haversine(qpSelectedPit.lat, qpSelectedPit.lon, cached.lat, cached.lon);
  }, [quickProposalLead, qpSelectedPit, qpPitId, geocodeCache]);

  // Recalculate price when PIT changes
  useEffect(() => {
    if (!qpSelectedPit || qpDistance == null) return;
    const eff = getEffectivePrice(qpSelectedPit, globalSettings);
    const extra = qpDistance > eff.free_miles ? (qpDistance - eff.free_miles) * eff.extra_per_mile : 0;
    setQpPrice((eff.base_price + extra).toFixed(2));
  }, [qpPitId, qpDistance, globalSettings]);

  const qpOrderUrl = useMemo(() => {
    if (!quickProposalLead) return "";
    const { zip } = parseAddress(quickProposalLead.address);
    return `https://riversand.net/order?address=${encodeURIComponent(quickProposalLead.address)}&price=${qpPrice}&zip=${zip}&lead=${encodeURIComponent(quickProposalLead.lead_number || "")}&utm_source=proposal&utm_medium=email&utm_campaign=direct_offer`;
  }, [quickProposalLead, qpPrice]);

  const sendQuickProposal = async () => {
    if (!quickProposalLead?.customer_email) return;
    setQpSending(true);
    try {
      const { zip } = parseAddress(quickProposalLead.address);
      await supabase.functions.invoke("send-email", {
        body: {
          type: "pit_proposal",
          data: {
            lead_number: quickProposalLead.lead_number,
            customer_name: quickProposalLead.customer_name,
            customer_email: quickProposalLead.customer_email,
            delivery_address: quickProposalLead.address,
            zip_code: zip,
            new_price: qpPrice,
            pit_name: qpSelectedPit?.name || "HQ",
            order_url: qpOrderUrl,
            custom_note: qpNote.trim() || undefined,
          },
        },
      });
      // Update lead stage + contacted + note
      await updateStage(quickProposalLead.id, "quoted");
      if (!quickProposalLead.contacted) {
        await supabase.functions.invoke("leads-auth", {
          body: { password: storedPassword(), action: "toggle_contacted", id: quickProposalLead.id },
        });
      }
      const timestamp = new Date().toLocaleString("en-US");
      await appendNote(quickProposalLead.id, `Offer sent ${timestamp} from ${qpSelectedPit?.name || "HQ"} at $${qpPrice}. Order link: ${qpOrderUrl}`);
      // Update local state
      setLeads(prev => prev.map(l => l.id === quickProposalLead.id ? { ...l, stage: "quoted", contacted: true } : l));
      toast({ title: `Offer sent to ${quickProposalLead.customer_email}` });
      setQuickProposalLead(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setQpSending(false);
    }
  };

  const StageBadge = ({ stage }: { stage: string }) => (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: STAGE_COLORS[stage] || "#999" }}>
      {stage.toUpperCase()}
    </span>
  );

  const ContactedBadge = ({ contacted, onClick, loading: btnLoading }: { contacted: boolean; onClick: () => void; loading: boolean }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={btnLoading}
      className="px-2 py-0.5 rounded-full text-xs font-bold cursor-pointer transition-colors"
      style={{
        backgroundColor: contacted ? "#22C55E20" : "#F59E0B20",
        color: contacted ? "#22C55E" : "#F59E0B",
        border: `1px solid ${contacted ? "#22C55E" : "#F59E0B"}`,
      }}
    >
      {btnLoading ? "..." : contacted ? "Contacted" : "Pending"}
    </button>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const colors = { active: { bg: "#22C55E20", text: "#22C55E" }, planning: { bg: "#1A6BB820", text: "#1A6BB8" }, inactive: { bg: "#99999920", text: "#999" } };
    const c = colors[status as keyof typeof colors] || colors.inactive;
    return <span className="text-xs px-2 py-0.5 rounded-full font-bold inline-block" style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.text}` }}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  // Detail modal
  const openDetail = (l: ParsedLead) => { setSelectedLead(l); setDetailStage(l.stage); setDetailNote(""); };

  const saveDetail = async () => {
    if (!selectedLead) return;
    setSavingDetail(true);
    if (detailStage !== selectedLead.stage) await updateStage(selectedLead.id, detailStage);
    if (detailNote.trim()) await appendNote(selectedLead.id, detailNote.trim());
    setSavingDetail(false);
    setSelectedLead(null);
    await fetchLeads(storedPassword());
  };

  // Metric card
  const MetricCard = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-lg p-3 text-center" style={{ backgroundColor: BRAND_NAVY }}>
      <p className="text-2xl font-bold" style={{ color: BRAND_GOLD }}>{value}</p>
      <p className="text-xs text-white/80 mt-1">{label}</p>
    </div>
  );

  // Filter select
  const FilterSelect = ({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 px-2 rounded-md border text-sm"
      style={{ borderColor: BRAND_NAVY + "40", color: BRAND_NAVY }}
      aria-label={label}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  // Table header
  const TH = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none ${className}`}
      style={{ backgroundColor: BRAND_NAVY, color: sortKey === col ? BRAND_GOLD : "white" }}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-1">{label}<SortIcon col={col} /></div>
    </th>
  );

  // Leads table
  const LeadsTable = ({ data, showStage = true }: { data: ParsedLead[]; showStage?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <TH col="lead_number" label="Lead #" />
            <TH col="created_at" label="Date" />
            <TH col="address" label="Address" />
            <TH col="state" label="State" />
            <TH col="zip" label="ZIP" />
            <TH col="distance_miles" label="Miles" />
            <TH col="nearest_pit_name" label="Nearest PIT" />
            <TH col="customer_name" label="Name" />
            <TH col="customer_email" label="Email" />
            <TH col="customer_phone" label="Phone" />
            {showStage && <TH col="stage" label="Stage" />}
            <TH col="contacted" label="Contacted" />
            <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: BRAND_NAVY, color: "white" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((l, i) => (
            <tr
              key={l.id}
              onClick={() => openDetail(l)}
              className="cursor-pointer transition-colors"
              style={{ backgroundColor: i % 2 === 0 ? "white" : "#F9F9F9" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#FFF8E7")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? "white" : "#F9F9F9")}
            >
              <td className="px-3 py-2 font-mono text-xs" style={{ color: BRAND_NAVY }}>{l.lead_number || `#${i + 1}`}</td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">{formatLeadDate(l.created_at)}</td>
              <td className="px-3 py-2 text-xs max-w-[200px] truncate">{l.address}</td>
              <td className="px-3 py-2 text-xs">{l.state}</td>
              <td className="px-3 py-2 text-xs">{l.zip}</td>
              <td className="px-3 py-2 text-xs">{l.distance_miles ? `${l.distance_miles.toFixed(1)} mi` : "—"}</td>
              <td className="px-3 py-2 text-xs">{l.nearest_pit_name ? `${l.nearest_pit_name} (${l.nearest_pit_distance?.toFixed(1)} mi)` : "—"}</td>
              <td className="px-3 py-2 text-xs font-medium">{l.customer_name}</td>
              <td className="px-3 py-2 text-xs">{l.customer_email || "—"}</td>
              <td className="px-3 py-2 text-xs">{l.customer_phone || "—"}</td>
              {showStage && <td className="px-3 py-2"><StageBadge stage={l.stage} /></td>}
              <td className="px-3 py-2">
                <ContactedBadge contacted={l.contacted} onClick={() => toggleContacted(l.id)} loading={toggling === l.id} />
              </td>
              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                {l.customer_email ? (
                  <button
                    onClick={() => openQuickProposal(l)}
                    className="px-2 py-1 rounded text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                    style={{ border: `1px solid ${BRAND_GOLD}`, color: BRAND_GOLD }}
                  >
                    <Send className="w-3 h-3" /> Send Offer
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">No email</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, #1a3a5c 100%)` }}>
        <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-sm">
          <div className="text-center mb-6">
            <Lock className="w-10 h-10 mx-auto mb-3" style={{ color: BRAND_GOLD }} />
            <h1 className="text-2xl font-bold" style={{ color: BRAND_NAVY }}>DELIVERY LEADS</h1>
            <p className="text-sm text-gray-500 mt-1">Enter password to access</p>
          </div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            className="mb-3"
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <Button onClick={handleLogin} disabled={loading} className="w-full" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ACCESS LEADS"}
          </Button>
        </div>
      </div>
    );
  }

  if (loading && leads.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f4f4f4" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND_GOLD }} />
      </div>
    );
  }

  const livePricing = `$${globalSettings.default_base_price} base · $${globalSettings.default_extra_per_mile}/mi · ${globalSettings.default_max_distance}mi max`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f4f4f4" }}>
      {/* Header */}
      <div className="px-4 py-4" style={{ backgroundColor: BRAND_NAVY }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wider" style={{ color: BRAND_GOLD }}>DELIVERY LEADS</h1>
            <p className="text-white/60 text-sm">{metrics.total} total leads · Live pricing: {livePricing}</p>
          </div>
          <Button onClick={exportCSV} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start overflow-x-auto mb-4 bg-white border">
            {["overview", "zip", "pipeline", "revenue", "pit", "all"].map(t => (
              <TabsTrigger
                key={t}
                value={t}
                className="text-xs uppercase tracking-wider data-[state=active]:text-[#C07A00] data-[state=active]:border-b-2 data-[state=active]:border-[#C07A00]"
              >
                {t === "overview" ? "Overview" : t === "zip" ? "ZIP Intelligence" : t === "pipeline" ? "Pipeline" : t === "revenue" ? "Revenue Forecast" : t === "pit" ? "PIT Simulator" : "All Leads"}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              <MetricCard label="Pipeline Value" value={`$${metrics.pipelineValue.toLocaleString()}`} />
              <MetricCard label="Hot ZIPs (2+)" value={zipData.filter(z => z.priority === "hot").length} />
              <MetricCard label="Not Contacted" value={metrics.notContacted} />
              <MetricCard label="Proposals Sent" value={metrics.quoted} />
              <MetricCard label="Converted" value={metrics.won} />
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400" /></button>}
              </div>
              <FilterSelect value={stageFilter} onChange={setStageFilter} label="Stage" options={[{ value: "all", label: "All stages" }, ...STAGES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))]} />
              <FilterSelect value={stateFilter} onChange={setStateFilter} label="State" options={[{ value: "all", label: "All states" }, ...states.map(s => ({ value: s, label: s }))]} />
              <FilterSelect value={dateFilter} onChange={setDateFilter} label="Date" options={[{ value: "all", label: "All time" }, { value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" }, { value: "year", label: "This year" }]} />
              <FilterSelect value={distanceFilter} onChange={setDistanceFilter} label="Distance" options={[{ value: "all", label: "All distances" }, { value: "30-50", label: "30-50 mi" }, { value: "50-75", label: "50-75 mi" }, { value: "75-100", label: "75-100 mi" }, { value: "100+", label: "100+ mi" }]} />
            </div>

            <div className="bg-white rounded-lg border shadow-sm">
              <LeadsTable data={paginatedLeads} />
              <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
                <span>Showing {Math.min((page - 1) * PAGE_SIZE + 1, sortedLeads.length)}–{Math.min(page * PAGE_SIZE, sortedLeads.length)} of {sortedLeads.length} leads</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                  <span>Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ZIP INTELLIGENCE TAB */}
          <TabsContent value="zip">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm" style={{ color: BRAND_NAVY }}>
                <strong>💡 ZIPs with 2+ leads = confirmed unserved demand.</strong> These are your next expansion markets.
              </p>
            </div>
            <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: BRAND_NAVY }}>
                    {["ZIP", "City", "State", "Leads", "Demand", "Est. Monthly Rev", "Avg Distance", "Priority"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zipData.map((z, i) => (
                    <tr key={z.zip} style={{ backgroundColor: i % 2 === 0 ? "white" : "#F9F9F9" }}>
                      <td className="px-3 py-2 font-mono font-bold" style={{ color: BRAND_NAVY }}>{z.zip}</td>
                      <td className="px-3 py-2">{z.city}</td>
                      <td className="px-3 py-2">{z.state}</td>
                      <td className="px-3 py-2 font-bold" style={{ color: BRAND_GOLD }}>{z.count}</td>
                      <td className="px-3 py-2">
                        <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(z.count / maxZipCount) * 100}%`, backgroundColor: BRAND_GOLD }} />
                        </div>
                      </td>
                      <td className="px-3 py-2 font-bold" style={{ color: BRAND_GOLD }}>${(z.count * basePrice * 20).toLocaleString()}</td>
                      <td className="px-3 py-2">{z.avgDist.toFixed(1)} mi</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: z.priority === "hot" ? BRAND_GOLD : z.priority === "warm" ? "#1A6BB8" : "#999" }}>
                          {z.priority.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* PIPELINE TAB */}
          <TabsContent value="pipeline">
            <div className="mb-4 text-center">
              <p className="text-lg font-bold" style={{ color: BRAND_NAVY }}>
                Active pipeline: <span style={{ color: BRAND_GOLD }}>${metrics.pipelineValue.toLocaleString()}</span>
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {STAGES.map(stage => {
                const stageLeads = parsedLeads.filter(l => l.stage === stage);
                return (
                  <div key={stage} className="rounded-lg border overflow-hidden" style={{ borderColor: STAGE_COLORS[stage] + "40" }}>
                    <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: STAGE_COLORS[stage] }}>
                      <span className="text-white text-xs font-bold uppercase tracking-wider">{stage}</span>
                      <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                    </div>
                    <div className="bg-gray-50 p-2 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
                      {stageLeads.map(l => (
                        <div key={l.id} onClick={() => openDetail(l)} className="bg-white rounded-lg p-3 border shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                          <p className="font-mono text-xs mb-1" style={{ color: BRAND_GOLD }}>{l.lead_number || "—"}</p>
                          <p className="font-bold text-sm" style={{ color: BRAND_NAVY }}>{l.customer_name}</p>
                          <p className="text-xs text-gray-500">{l.zip} • {l.distance_miles?.toFixed(1) || "?"} mi</p>
                          {l.customer_email && <p className="text-xs text-gray-400 truncate">{l.customer_email}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* REVENUE FORECAST TAB */}
          <TabsContent value="revenue">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-lg p-6 text-center" style={{ backgroundColor: BRAND_NAVY }}>
                <p className="text-white/60 text-sm">Immediate Opportunity</p>
                <p className="text-3xl font-bold mt-2" style={{ color: BRAND_GOLD }}>${(metrics.notContacted * basePrice).toLocaleString()}</p>
                <p className="text-white/40 text-xs mt-1">{metrics.notContacted} uncontacted leads × ${basePrice}</p>
              </div>
              <div className="rounded-lg p-6 text-center" style={{ backgroundColor: BRAND_NAVY }}>
                <p className="text-white/60 text-sm">Total Pipeline</p>
                <p className="text-3xl font-bold mt-2" style={{ color: BRAND_GOLD }}>${(metrics.total * basePrice).toLocaleString()}</p>
                <p className="text-white/40 text-xs mt-1">{metrics.total} total leads × ${basePrice}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: BRAND_NAVY }}>
                    {["ZIP / Market", "Leads", "Monthly Revenue", "Break-even (months)"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-white uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zipData.filter(z => z.priority === "hot").map((z, i) => {
                    const monthlyRev = z.count * 5 * basePrice * 4;
                    const breakEven = monthlyRev > 0 ? (3000 / monthlyRev).toFixed(1) : "—";
                    return (
                      <tr key={z.zip} style={{ backgroundColor: i % 2 === 0 ? "white" : "#F9F9F9" }}>
                        <td className="px-4 py-3 font-bold" style={{ color: BRAND_NAVY }}>{z.zip} — {z.city}, {z.state}</td>
                        <td className="px-4 py-3 font-bold" style={{ color: BRAND_GOLD }}>{z.count}</td>
                        <td className="px-4 py-3 font-bold" style={{ color: BRAND_GOLD }}>${monthlyRev.toLocaleString()}</td>
                        <td className="px-4 py-3">{breakEven} mo</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-lg border shadow-sm mt-4 p-6">
              <h3 className="text-sm font-bold mb-4" style={{ color: BRAND_NAVY }}>Projected Monthly Revenue by Market</h3>
              <div className="space-y-3">
                {zipData.filter(z => z.priority === "hot").map(z => {
                  const rev = z.count * 5 * basePrice * 4;
                  const maxRev = Math.max(...zipData.filter(zz => zz.priority === "hot").map(zz => zz.count * 5 * basePrice * 4), 1);
                  return (
                    <div key={z.zip} className="flex items-center gap-3">
                      <span className="text-xs font-mono w-16" style={{ color: BRAND_NAVY }}>{z.zip}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${(rev / maxRev) * 100}%`, backgroundColor: rev === maxRev ? BRAND_GOLD : BRAND_NAVY }} />
                      </div>
                      <span className="text-xs font-bold w-24 text-right" style={{ color: BRAND_GOLD }}>${rev.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* PIT SIMULATOR TAB */}
          <TabsContent value="pit">
            {/* Global Settings Panel */}
            <div className="bg-white rounded-lg border shadow-sm p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-5 h-5" style={{ color: BRAND_GOLD }} />
                <div>
                  <h3 className="font-bold text-sm" style={{ color: BRAND_NAVY }}>Global Pricing Defaults</h3>
                  <p className="text-xs text-gray-500">These apply to all PITs unless overridden individually</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Base price per load</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <Input
                      className="pl-6 h-9"
                      value={editSettings.default_base_price || ""}
                      onChange={e => setEditSettings({ ...editSettings, default_base_price: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Free delivery radius</label>
                  <div className="relative">
                    <Input
                      className="pr-12 h-9"
                      value={editSettings.default_free_miles || ""}
                      onChange={e => setEditSettings({ ...editSettings, default_free_miles: e.target.value })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">miles</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Extra per mile</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <Input
                      className="pl-6 pr-12 h-9"
                      value={editSettings.default_extra_per_mile || ""}
                      onChange={e => setEditSettings({ ...editSettings, default_extra_per_mile: e.target.value })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">/mile</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Max delivery distance</label>
                  <div className="relative">
                    <Input
                      className="pr-12 h-9"
                      value={editSettings.default_max_distance || ""}
                      onChange={e => setEditSettings({ ...editSettings, default_max_distance: e.target.value })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">miles</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Saturday surcharge</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <Input
                      className="pl-6 h-9"
                      value={editSettings.saturday_surcharge || ""}
                      onChange={e => setEditSettings({ ...editSettings, saturday_surcharge: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-gray-400">Changes here instantly update pricing across all PITs that don't have their own override. The landing page price will also update automatically.</p>
                <Button onClick={saveGlobalSettings} disabled={savingSettings} size="sm" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save Global Settings
                </Button>
              </div>
            </div>

            {/* PIT Manager */}
            <div className="bg-white rounded-lg border shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm" style={{ color: BRAND_NAVY }}>PIT Manager</h3>
                <div className="flex gap-2">
                  <Button onClick={geocodeAllLeads} disabled={geocoding} variant="outline" size="sm">
                    {geocoding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MapPin className="w-4 h-4 mr-1" />}
                    Geocode All Leads
                  </Button>
                  <Button onClick={() => setShowAddPit(true)} size="sm" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                    + Add New PIT
                  </Button>
                </div>
              </div>

              {/* PIT Cards */}
              <div className="flex flex-wrap gap-3">
                {pits.map(p => {
                  const eff = getEffectivePrice(p, globalSettings);
                  const hasOverride = p.base_price != null || p.free_miles != null || p.price_per_extra_mile != null || p.max_distance != null;

                  if (editingPitId === p.id) {
                    // Edit mode
                    return (
                      <div key={p.id} className="border-2 rounded-lg p-4 flex-1 min-w-[280px]" style={{ borderColor: BRAND_GOLD }}>
                        <div className="space-y-3">
                          <Input placeholder="PIT Name" value={editPitData.name || ""} onChange={e => setEditPitData({ ...editPitData, name: e.target.value })} />
                          <Input placeholder="PIT Address" value={editPitData.address || ""} onChange={e => setEditPitData({ ...editPitData, address: e.target.value })} />
                          <select
                            value={editPitData.status || "active"}
                            onChange={e => setEditPitData({ ...editPitData, status: e.target.value as any })}
                            className="w-full h-10 px-3 rounded-md border"
                          >
                            <option value="active">Active</option>
                            <option value="planning">Planning</option>
                            <option value="inactive">Inactive</option>
                          </select>
                          <div className="border-t pt-3">
                            <p className="text-xs font-bold mb-2" style={{ color: BRAND_NAVY }}>Pricing Overrides (leave blank to use global)</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-400">Base price</label>
                                <Input
                                  placeholder={`Global: $${globalSettings.default_base_price}`}
                                  value={editPitData.base_price ?? ""}
                                  onChange={e => setEditPitData({ ...editPitData, base_price: e.target.value ? parseFloat(e.target.value) : null })}
                                  type="number"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Free miles</label>
                                <Input
                                  placeholder={`Global: ${globalSettings.default_free_miles} mi`}
                                  value={editPitData.free_miles ?? ""}
                                  onChange={e => setEditPitData({ ...editPitData, free_miles: e.target.value ? parseFloat(e.target.value) : null })}
                                  type="number"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Extra per mile</label>
                                <Input
                                  placeholder={`Global: $${globalSettings.default_extra_per_mile}/mi`}
                                  value={editPitData.price_per_extra_mile ?? ""}
                                  onChange={e => setEditPitData({ ...editPitData, price_per_extra_mile: e.target.value ? parseFloat(e.target.value) : null })}
                                  type="number"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Max distance</label>
                                <Input
                                  placeholder={`Global: ${globalSettings.default_max_distance} mi`}
                                  value={editPitData.max_distance ?? ""}
                                  onChange={e => setEditPitData({ ...editPitData, max_distance: e.target.value ? parseFloat(e.target.value) : null })}
                                  type="number"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={saveEditPit} disabled={savingPit} size="sm" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                              {savingPit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                            </Button>
                            <Button onClick={cancelEditPit} variant="outline" size="sm">Cancel</Button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Read-only card
                  return (
                    <div key={p.id} className="border rounded-lg p-3 flex-1 min-w-[220px]" style={{ borderColor: selectedPit?.id === p.id ? BRAND_GOLD : BRAND_NAVY + "30" }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-sm" style={{ color: BRAND_NAVY }}>{p.name}</p>
                        {p.is_default && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Default</span>}
                      </div>
                      <p className="text-xs text-gray-500">{p.address}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-xs mt-2" style={{ color: hasOverride ? BRAND_GOLD : "#999" }}>
                        Effective: ${eff.base_price} base · {eff.free_miles}mi free · ${eff.extra_per_mile}/mi · {eff.max_distance}mi max
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedPit(p)} className="text-xs h-7">Simulate</Button>
                        <Button size="sm" variant="outline" onClick={() => startEditPit(p)} className="text-xs h-7">
                          <Edit2 className="w-3 h-3 mr-1" />Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => togglePitStatus(p)}
                          className="text-xs h-7"
                          style={{
                            borderColor: p.status === "active" ? "#EF444430" : "#22C55E30",
                            color: p.status === "active" ? "#EF4444" : "#22C55E",
                          }}
                        >
                          <Power className="w-3 h-3 mr-1" />
                          {p.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                        {!p.is_default && (
                          <Button size="sm" variant="outline" onClick={() => deletePit(p.id)} className="text-xs h-7 text-red-500 border-red-200">Delete</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add PIT form */}
              {showAddPit && (
                <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input placeholder="PIT Name" value={newPit.name} onChange={e => setNewPit({ ...newPit, name: e.target.value })} />
                    <Input ref={pitInputRef} placeholder="PIT Address" value={newPit.address} onChange={e => setNewPit({ ...newPit, address: e.target.value })} />
                    <select
                      value={newPit.status}
                      onChange={e => setNewPit({ ...newPit, status: e.target.value as any })}
                      className="h-10 px-3 rounded-md border"
                    >
                      <option value="planning">Planning</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <Input placeholder="Notes" value={newPit.notes} onChange={e => setNewPit({ ...newPit, notes: e.target.value })} />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button onClick={addPit} disabled={geocoding} size="sm" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                      {geocoding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      Add PIT
                    </Button>
                    <Button onClick={() => setShowAddPit(false)} variant="outline" size="sm">Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            {/* ROI Summary */}
            {selectedPit && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {(() => {
                    const eff = getEffectivePrice(selectedPit, globalSettings);
                    const serviceable = simData.filter(d => d.status === "serviceable");
                    const immediateRev = serviceable.length * eff.base_price;
                    const monthlyPotential = serviceable.length * 5 * eff.base_price * 4;
                    const breakEven = monthlyPotential > 0 ? (3000 / monthlyPotential).toFixed(1) : "—";
                    return (
                      <>
                        <MetricCard label="Newly Serviceable" value={serviceable.length} />
                        <MetricCard label="Immediate Revenue" value={`$${immediateRev.toLocaleString()}`} />
                        <MetricCard label="Monthly Potential" value={`$${monthlyPotential.toLocaleString()}`} />
                        <MetricCard label="Break-even" value={`${breakEven} mo`} />
                      </>
                    );
                  })()}
                </div>

                {/* Simulation table */}
                <div className="bg-white rounded-lg border shadow-sm mb-4">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h3 className="font-bold text-sm" style={{ color: BRAND_NAVY }}>
                      Simulation from: {selectedPit.name}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const serviceableIds = new Set(simData.filter(d => d.status === "serviceable").map(d => d.lead.id));
                          setSimSelected(serviceableIds);
                        }}
                      >
                        Select All Serviceable
                      </Button>
                      <Button
                        size="sm"
                        disabled={simSelected.size === 0}
                        onClick={() => {
                          const first = simData.find(d => simSelected.has(d.lead.id));
                          if (first) setProposalSubject(`River Sand is now available near ${parseAddress(first.lead.address).zip} — Your price: $${first.newPrice.toFixed(2)}`);
                          setShowProposal(true);
                        }}
                        style={{ backgroundColor: BRAND_GOLD, color: "white" }}
                      >
                        <Send className="w-4 h-4 mr-1" /> Send Proposal ({simSelected.size})
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: BRAND_NAVY }}>
                          <th className="px-3 py-2 text-white text-xs w-8"><input type="checkbox" checked={simSelected.size === simData.length && simData.length > 0} onChange={e => setSimSelected(e.target.checked ? new Set(simData.map(d => d.lead.id)) : new Set())} /></th>
                          {["Lead #", "Name", "Address / ZIP", "HQ Dist", "PIT Dist", "Delta", "New Price", "Savings", "Status"].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-bold text-white uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {simData.map((d, i) => {
                          const eff = getEffectivePrice(selectedPit, globalSettings);
                          const oldExtra = d.hqDist > eff.free_miles ? (d.hqDist - eff.free_miles) * eff.extra_per_mile : 0;
                          const oldPrice = eff.base_price + oldExtra;
                          const savings = oldPrice - d.newPrice;
                          return (
                            <tr key={d.lead.id} style={{ backgroundColor: i % 2 === 0 ? "white" : "#F9F9F9" }}>
                              <td className="px-3 py-2"><input type="checkbox" checked={simSelected.has(d.lead.id)} onChange={e => { const s = new Set(simSelected); e.target.checked ? s.add(d.lead.id) : s.delete(d.lead.id); setSimSelected(s); }} /></td>
                              <td className="px-3 py-2 font-mono text-xs" style={{ color: BRAND_NAVY }}>{d.lead.lead_number || "—"}</td>
                              <td className="px-3 py-2 text-xs font-medium">{d.lead.customer_name}</td>
                              <td className="px-3 py-2 text-xs max-w-[150px] truncate">{parseAddress(d.lead.address).zip}</td>
                              <td className="px-3 py-2 text-xs">{d.hqDist.toFixed(1)} mi</td>
                              <td className="px-3 py-2 text-xs font-bold" style={{ color: BRAND_GOLD }}>{d.pitDist?.toFixed(1)} mi</td>
                              <td className="px-3 py-2 text-xs" style={{ color: d.delta > 0 ? "#22C55E" : "#999" }}>{d.delta > 0 ? `-${d.delta.toFixed(1)}` : "+0"} mi</td>
                              <td className="px-3 py-2 text-xs font-bold" style={{ color: BRAND_GOLD }}>${d.newPrice.toFixed(2)}</td>
                              <td className="px-3 py-2 text-xs">{savings > 0 ? <span style={{ color: "#22C55E" }}>saves ${savings.toFixed(0)}</span> : "—"}</td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{
                                  backgroundColor: d.status === "serviceable" ? "#22C55E" : d.status === "closer" ? "#1A6BB8" : "#999"
                                }}>
                                  {d.status === "serviceable" ? "Serviceable" : d.status === "closer" ? "Closer" : "Same"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ALL LEADS TAB */}
          <TabsContent value="all">
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400" /></button>}
              </div>
              <FilterSelect value={stageFilter} onChange={setStageFilter} label="Stage" options={[{ value: "all", label: "All stages" }, ...STAGES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))]} />
              <FilterSelect value={stateFilter} onChange={setStateFilter} label="State" options={[{ value: "all", label: "All states" }, ...states.map(s => ({ value: s, label: s }))]} />
              <FilterSelect value={dateFilter} onChange={setDateFilter} label="Date" options={[{ value: "all", label: "All time" }, { value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" }, { value: "year", label: "This year" }]} />
              <FilterSelect value={distanceFilter} onChange={setDistanceFilter} label="Distance" options={[{ value: "all", label: "All distances" }, { value: "30-50", label: "30-50 mi" }, { value: "50-75", label: "50-75 mi" }, { value: "75-100", label: "75-100 mi" }, { value: "100+", label: "100+ mi" }]} />
            </div>
            <div className="bg-white rounded-lg border shadow-sm">
              <LeadsTable data={paginatedLeads} />
              <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
                <span>Showing {Math.min((page - 1) * PAGE_SIZE + 1, sortedLeads.length)}–{Math.min(page * PAGE_SIZE, sortedLeads.length)} of {sortedLeads.length} leads</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                  <span>Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b" style={{ backgroundColor: BRAND_NAVY }}>
              <p className="font-mono text-sm" style={{ color: BRAND_GOLD }}>{selectedLead.lead_number || "—"}</p>
              <h2 className="text-lg font-bold text-white">{selectedLead.customer_name}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">Submitted</p><p className="font-medium">{formatLeadDate(selectedLead.created_at)}</p></div>
                <div><p className="text-xs text-gray-400">IP Address</p><p className="font-mono text-xs">{selectedLead.ip_address || "—"}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-400">Address</p><p className="font-medium">{selectedLead.address}</p></div>
                <div><p className="text-xs text-gray-400">Distance</p><p>{selectedLead.distance_miles?.toFixed(1) || "—"} mi</p></div>
                <div><p className="text-xs text-gray-400">Email</p><p>{selectedLead.customer_email || "—"}</p></div>
                <div><p className="text-xs text-gray-400">Phone</p><p>{selectedLead.customer_phone || "—"}</p></div>
                <div>
                  <p className="text-xs text-gray-400">Contacted</p>
                  <ContactedBadge contacted={selectedLead.contacted} onClick={() => { toggleContacted(selectedLead.id); setSelectedLead({ ...selectedLead, contacted: !selectedLead.contacted }); }} loading={toggling === selectedLead.id} />
                </div>
              </div>

              {selectedLead.stage === "won" && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                  <span className="text-green-700 font-bold text-sm">✅ ORDER PLACED</span>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 block mb-1">Stage</label>
                <select value={detailStage} onChange={e => setDetailStage(e.target.value)} className="w-full h-10 px-3 rounded-md border">
                  {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>

              {selectedLead.notes && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">History</p>
                  <pre className="text-xs bg-gray-50 p-3 rounded border whitespace-pre-wrap max-h-32 overflow-y-auto">{selectedLead.notes}</pre>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 block mb-1">Add Note</label>
                <Textarea rows={2} value={detailNote} onChange={e => setDetailNote(e.target.value)} placeholder="Type a note..." />
              </div>

              <div className="flex gap-2">
                <Button onClick={saveDetail} disabled={savingDetail} className="flex-1" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                  {savingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </Button>
                <Button onClick={() => setSelectedLead(null)} variant="outline" className="flex-1">Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Modal */}
      {showProposal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !sendingProposals && setShowProposal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b" style={{ backgroundColor: BRAND_NAVY }}>
              <h2 className="text-lg font-bold" style={{ color: BRAND_GOLD }}>Send Proposals</h2>
              <p className="text-white/60 text-sm">{simSelected.size} leads selected</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Subject</label>
                <Input value={proposalSubject} onChange={e => setProposalSubject(e.target.value)} />
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-xs text-gray-400 mb-2">Preview (first lead)</p>
                {(() => {
                  const first = simData.find(d => simSelected.has(d.lead.id));
                  if (!first) return <p className="text-sm text-gray-500">No lead selected</p>;
                  return (
                    <div className="text-sm space-y-2">
                      <p>Hi {first.lead.customer_name.split(" ")[0]},</p>
                      <p>Good news — River Sand now delivers near {parseAddress(first.lead.address).zip}!</p>
                      <div className="border-2 rounded-lg p-4 text-center" style={{ borderColor: BRAND_GOLD }}>
                        <p className="text-xs uppercase text-gray-500">River Sand — 9 Cubic Yards</p>
                        <p className="text-xs text-gray-400">Delivered to: {first.lead.address}</p>
                        <p className="text-2xl font-bold mt-2" style={{ color: BRAND_GOLD }}>${first.newPrice.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {sendingProposals && (
                <div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%`, backgroundColor: BRAND_GOLD }} />
                  </div>
                  <p className="text-xs text-center mt-1 text-gray-500">Sending {sendProgress.current} of {sendProgress.total}...</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={sendProposals} disabled={sendingProposals} className="flex-1" style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                  {sendingProposals ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  Send to {simSelected.size} leads
                </Button>
                <Button onClick={() => setShowProposal(false)} disabled={sendingProposals} variant="outline">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-4 text-xs text-gray-400">Powered by Haulogix, LLC</div>
    </div>
  );
};

export default Leads;
