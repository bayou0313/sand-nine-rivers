import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check admin role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        throw new Error("Access denied. Admin privileges required.");
      }

      navigate("/admin");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-display text-background tracking-wider">ADMIN LOGIN</h1>
          <p className="font-body text-background/50 mt-2">RiverSand Order Management</p>
        </div>

        <form onSubmit={handleLogin} className="bg-background rounded-lg p-8 border border-border space-y-4">
          <div>
            <label className="font-display text-sm text-foreground tracking-wider block mb-1">EMAIL</label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" placeholder="admin@riversand.net" maxLength={255} />
          </div>
          <div>
            <label className="font-display text-sm text-foreground tracking-wider block mb-1">PASSWORD</label>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" placeholder="••••••••" maxLength={128} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 font-display tracking-wider text-lg">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "SIGN IN"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
