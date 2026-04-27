import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { PriceTicker } from "@/components/PriceTicker";
import { PriceChart } from "@/components/PriceChart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/prices";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

function Dashboard() {
  const { user } = useAuth();
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [selected, setSelected] = useState<string>("BTCUSDT");
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: wl } = await supabase
        .from("watchlist")
        .select("symbol")
        .eq("user_id", user.id)
        .order("position");
      if (wl && wl.length > 0) setSymbols(wl.map((w) => w.symbol));

      const { data: al } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);
      setActiveAlerts(al ?? []);

      const { data: hi } = await supabase
        .from("alert_history")
        .select("*")
        .eq("user_id", user.id)
        .order("triggered_at", { ascending: false })
        .limit(5);
      setHistory(hi ?? []);
    })();
  }, [user]);

  return (
    <div className="space-y-6 lg:space-y-8 max-w-[1400px] mx-auto">
      <div>
        <h1 className="font-display text-3xl font-bold lg:text-4xl">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Live market overview & your active alerts.</p>
      </div>

      <PriceTicker symbols={symbols} onSelect={setSelected} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PriceChart symbol={selected} />
        </div>

        <div className="space-y-6">
          {/* Active alerts */}
          <Card className="p-5 bg-gradient-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Active alerts
              </h3>
              <Badge variant="secondary">{activeAlerts.length}</Badge>
            </div>
            {activeAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active alerts. Create one from the Alerts page.
              </p>
            ) : (
              <ul className="space-y-2">
                {activeAlerts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-3 text-sm"
                  >
                    <div>
                      <div className="font-mono font-semibold">{a.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.condition} ${formatPrice(parseFloat(a.target_price))}
                      </div>
                    </div>
                    <span
                      className={`h-2 w-2 rounded-full ${a.condition === "above" ? "bg-bull" : "bg-bear"}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* History */}
          <Card className="p-5 bg-gradient-card border border-border">
            <h3 className="font-display font-semibold mb-4">Recent triggers</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerts have triggered yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg border border-border bg-background/40 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-semibold">{h.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.triggered_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {h.condition} ${formatPrice(parseFloat(h.target_price))} → fired @ $
                      {formatPrice(parseFloat(h.triggered_price))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
