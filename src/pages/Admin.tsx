import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Package, RefreshCw, Phone, MapPin, DollarSign, Clock, Loader2, ChevronDown, ChevronUp, CreditCard, CalendarDays, Zap } from "lucide-react";
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
  payment_status: string;
  stripe_payment_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  delivery_date: string | null;
  delivery_day_of_week: string | null;
  saturday_surcharge: boolean;
  saturday_surcharge_amount: number;
  same_day_requested: boolean;
  delivery_window: string;
};

type PaymentEvent = {
  id: string;
  order_id: string | null;
  stripe_payment_id: string | null;
  event_type: string;
  event_id: string;
  created_at: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  confirmed: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  en_route: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  delivered: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

const paymentStatusColors: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  failed: "bg-red-500/15 text-red-700 border-red-500/30",
  canceled: "bg-red-500/15 text-red-700 border-red-500/30",
  refunded: "bg-blue-500/15 text-blue-700 border-blue-500/30",
};

const paymentLabel = (method: string, status: string) => {
  if (method === "card" && status === "paid") return "Card ✓";
  if (method === "card") return `Card (${status})`;
  return `${method.charAt(0).toUpperCase() + method.slice(1)} (${status})`;
};

function formatDeliveryDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [paymentEvents, setPaymentEvents] = useState<Record<string, PaymentEvent[]>>({});
  const [loadingEvents, setLoadingEvents] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("orders")
      .select("*")
      .order("delivery_date", { ascending: true, nullsFirst: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders((data as Order[]) || []);
    }
    setLoading(false);
  };

  const fetchPaymentEvents = async (orderId: string) => {
    if (paymentEvents[orderId]) return;
    setLoadingEvents(orderId);
    const { data, error } = await (supabase as any)
      .from("payment_events")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPaymentEvents((prev) => ({ ...prev, [orderId]: data as PaymentEvent[] }));
    }
    setLoadingEvents(null);
  };

  const toggleExpand = (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      fetchPaymentEvents(orderId);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate("/admin/login"); return; }
      (supabase as any).from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").then(({ data }: any) => {
        if (!data || data.length === 0) { navigate("/admin/login"); return; }
        fetchOrders();
      });
    });
  }, []);

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await (supabase as any)
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
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
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
              <div key={order.id} className="bg-card border border-border rounded-xl">
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-xl text-foreground">{order.customer_name}</h3>
                        <Badge variant="outline" className={statusColors[order.status] || ""}>{order.status.toUpperCase()}</Badge>
                        <Badge variant="outline" className={paymentStatusColors[order.payment_status] || paymentStatusColors.pending}>
                          <CreditCard className="w-3 h-3 mr-1" />
                          {paymentLabel(order.payment_method, order.payment_status)}
                        </Badge>
                        {order.same_day_requested && (
                          <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                            <Zap className="w-3 h-3 mr-1" /> Same Day
                          </Badge>
                        )}
                        {order.saturday_surcharge && (
                          <Badge variant="outline" className="bg-amber-400/15 text-amber-600 border-amber-400/30">
                            SAT +$35
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 font-body text-sm">
                        <p className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {order.customer_phone}</p>
                        <p className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {order.delivery_address}</p>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDeliveryDate(order.delivery_date)}
                          {order.delivery_day_of_week ? ` (${order.delivery_day_of_week})` : ""}
                        </p>
                        <p className="text-muted-foreground">{order.distance_miles} miles • {order.payment_method}</p>
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

                  {order.stripe_payment_id && (
                    <button
                      onClick={() => toggleExpand(order.id)}
                      className="mt-3 flex items-center gap-1 font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expandedOrder === order.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Payment Events
                    </button>
                  )}
                </div>

                {expandedOrder === order.id && (
                  <div className="border-t border-border px-6 py-4 bg-muted/30 rounded-b-xl">
                    {loadingEvents === order.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : paymentEvents[order.id]?.length ? (
                      <div className="space-y-2">
                        <p className="font-display text-xs text-muted-foreground tracking-wider mb-2">PAYMENT HISTORY</p>
                        {paymentEvents[order.id].map((evt) => (
                          <div key={evt.id} className="flex items-center justify-between font-body text-sm">
                            <span className="text-foreground">{evt.event_type}</span>
                            <span className="text-muted-foreground text-xs">{new Date(evt.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="font-body text-sm text-muted-foreground">No payment events recorded.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
