import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Package, RefreshCw, Phone, MapPin, DollarSign, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Order = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  delivery_address: string;
  distance_miles: number;
  price: number;
  payment_method: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  confirmed: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  en_route: "bg-purple-500/20 text-purple-700 border-purple-500/30",
  delivered: "bg-green-500/20 text-green-700 border-green-500/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders((data as Order[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Check auth
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate("/admin/login"); return; }
      (supabase as any).from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").then(({ data }: any) => {
        if (!data || data.length === 0) { navigate("/admin/login"); return; }
        fetchOrders();
      });
    });
  }, []);

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Order status changed to ${newStatus}` });
      fetchOrders();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    revenue: orders.filter((o) => o.status === "delivered").reduce((s, o) => s + Number(o.price), 0),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-foreground border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-primary" />
            <span className="text-2xl font-display text-background tracking-wider">RIVERSAND ADMIN</span>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-background/60 hover:text-background hover:bg-background/10">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Orders", value: stats.total, icon: Package },
            { label: "Pending", value: stats.pending, icon: Clock },
            { label: "Confirmed", value: stats.confirmed, icon: RefreshCw },
            { label: "Delivered", value: stats.delivered, icon: MapPin },
            { label: "Revenue", value: `$${stats.revenue.toFixed(0)}`, icon: DollarSign },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="w-4 h-4 text-primary" />
                <span className="font-body text-xs text-muted-foreground uppercase">{s.label}</span>
              </div>
              <p className="font-display text-3xl text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter + Refresh */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40 font-body">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="en_route">En Route</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <span className="font-body text-sm text-muted-foreground">{filtered.length} orders</span>
          </div>
          <Button variant="outline" onClick={fetchOrders} className="font-display tracking-wider">
            <RefreshCw className="w-4 h-4 mr-2" /> REFRESH
          </Button>
        </div>

        {/* Orders */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-display text-2xl text-muted-foreground">NO ORDERS YET</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((order) => (
              <div key={order.id} className="bg-card border border-border rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-xl text-foreground">{order.customer_name}</h3>
                      <Badge variant="outline" className={statusColors[order.status] || ""}>{order.status.toUpperCase()}</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 font-body text-sm">
                      <p className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {order.customer_phone}</p>
                      <p className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {order.delivery_address}</p>
                      <p className="text-muted-foreground">{order.distance_miles} miles • {order.payment_method}</p>
                      <p className="text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    {order.notes && <p className="font-body text-sm text-muted-foreground italic">"{order.notes}"</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-display text-2xl text-primary">${Number(order.price).toFixed(2)}</p>
                    <Select value={order.status} onValueChange={(v) => updateStatus(order.id, v)}>
                      <SelectTrigger className="w-36 font-body text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="en_route">En Route</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
