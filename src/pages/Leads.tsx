import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, CheckCircle2, Circle } from "lucide-react";

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

const Leads = () => {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f4f4]">
      {/* Header */}
      <header className="bg-[#0D2137] px-6 py-4 flex items-center justify-between">
        <h1 className="text-[#C07A00] font-bold text-lg tracking-widest">DELIVERY LEADS</h1>
        <span className="text-white/60 text-sm">{leads.length} lead{leads.length !== 1 ? "s" : ""}</span>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#0D2137]" />
          </div>
        ) : leads.length === 0 ? (
          <p className="text-center text-gray-500 py-20">No leads yet.</p>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#0D2137] uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#0D2137] uppercase tracking-wider">Address</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#0D2137] uppercase tracking-wider">Miles</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#0D2137] uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#0D2137] uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#0D2137] uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#0D2137] uppercase tracking-wider">Contacted</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(lead.created_at)}</td>
                    <td className="px-4 py-3 text-gray-800 max-w-[250px] truncate" title={lead.address}>{lead.address}</td>
                    <td className="px-4 py-3 text-gray-600">{lead.distance_miles != null ? `${Number(lead.distance_miles).toFixed(1)}` : "—"}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{lead.customer_name}</td>
                    <td className="px-4 py-3 text-gray-600">{lead.customer_email || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{lead.customer_phone || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleContacted(lead.id)}
                        disabled={toggling === lead.id}
                        className="inline-flex items-center justify-center"
                        title={lead.contacted ? "Mark as not contacted" : "Mark as contacted"}
                      >
                        {toggling === lead.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        ) : lead.contacted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 hover:text-[#C07A00] transition-colors" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
