import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Bell, Plus, Trash2, ArrowDown, ArrowUp, History, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { streamTickers, fetchTickers, formatPrice } from "@/lib/prices";
import { requestPushPermission } from "@/lib/pushNotifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/alerts")({
  component: AlertsPage,
});

const schema = z.object({
  symbol: z.string().trim().min(2).max(20).regex(/^[A-Z0-9]+$/, "Use uppercase letters and digits only"),
  condition: z.enum(["above", "below"]),
  target: z.number().positive("Target price must be positive"),
  note: z.string().max(200).optional(),
});

type Alert = {
  id: string;
  symbol: string;
  condition: "above" | "below";
  target_price: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
};

type HistoryRow = {
  id: string;
  symbol: string;
  condition: "above" | "below";
  target_price: number;
  triggered_price: number;
  triggered_at: string;
  email_status: string | null;
  push_status: string | null;
};

function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [livePrices, setLivePrices] = useState<Map<string, number>>(new Map());
  const [pushStatus, setPushStatus] = useState<NotificationPermission>("default");
  const stopStream = useRef<(() => void) | null>(null);

  // Check push permission on mount
  useEffect(() => {
    if ("Notification" in window) setPushStatus(Notification.permission);
  }, []);

  async function load() {
    if (!user) return;
    const { data: a } = await supabase
      .from("alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setAlerts((a ?? []) as Alert[]);

    const { data: h } = await supabase
      .from("alert_history")
      .select("*")
      .eq("user_id", user.id)
      .order("triggered_at", { ascending: false })
      .limit(100);
    setHistory((h ?? []) as HistoryRow[]);
  }

  // Initial load + realtime subscription
  useEffect(() => {
    if (!user) return;
    load();

    // Listen for DB changes (alert fires delete the row — we pick that up here)
    const channel = supabase
      .channel("alerts-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alert_history", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Stream live prices for all alert symbols
  useEffect(() => {
    if (stopStream.current) { stopStream.current(); stopStream.current = null; }
    const symbols = [...new Set(alerts.map(a => a.symbol))];
    if (symbols.length === 0) return;

    stopStream.current = streamTickers(symbols, ({ symbol: sym, price }) => {
      setLivePrices(prev => new Map(prev).set(sym, price));
    });
    return () => { if (stopStream.current) stopStream.current(); };
  }, [alerts.map(a => a.symbol).join(",")]);

  // Preview current price when typing symbol in dialog
  useEffect(() => {
    if (!symbol || symbol.length < 4) { setCurrentPrice(null); return; }
    const t = setTimeout(() => {
      fetchTickers([symbol])
        .then(t => setCurrentPrice(t[0]?.price ?? null))
        .catch(() => setCurrentPrice(null));
    }, 500);
    return () => clearTimeout(t);
  }, [symbol]);

  async function enablePush() {
    const perm = await requestPushPermission();
    setPushStatus(perm);
    if (perm === "granted") toast.success("Push notifications enabled!");
    else if (perm === "denied") toast.error("Push blocked. Enable in browser settings.");
    else toast.info("Permission dismissed");
  }

  async function save() {
    if (!user) return;
    const parsed = schema.safeParse({
      symbol: symbol.toUpperCase().trim(),
      condition,
      target: parseFloat(target),
      note: note || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    const { error } = await supabase.from("alerts").insert({
      user_id: user.id,
      symbol: parsed.data.symbol,
      asset_type: "crypto",
      condition: parsed.data.condition,
      target_price: parsed.data.target,
      note: parsed.data.note ?? null,
      is_active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Alert created — engine is watching");
    setOpen(false);
    setTarget("");
    setNote("");
    load();
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("alerts").update({ is_active: !current }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    await supabase.from("alerts").delete().eq("id", id);
    toast.success("Alert deleted");
    load();
  }

  async function clearHistory() {
    if (!user) return;
    await supabase.from("alert_history").delete().eq("user_id", user.id);
    setHistory([]);
    toast.success("History cleared");
  }

  const activeAlerts = alerts.filter(a => a.is_active);
  const inactiveAlerts = alerts.filter(a => !a.is_active);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold lg:text-4xl">Alerts</h1>
          <p className="text-muted-foreground mt-1">Get notified the instant prices cross your targets.</p>
        </div>
        <div className="flex items-center gap-2">
          {pushStatus !== "granted" && (
            <Button variant="outline" size="sm" onClick={enablePush} className="gap-2">
              <Bell className="h-3.5 w-3.5" />
              Enable push
            </Button>
          )}
          {pushStatus === "granted" && (
            <Badge variant="secondary" className="gap-1.5 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-bull" />
              Push on
            </Badge>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                <Plus className="h-4 w-4 mr-1" /> New alert
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Create price alert</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-1">
                {/* Symbol */}
                <div className="space-y-1.5">
                  <Label htmlFor="sym">Symbol</Label>
                  <Input
                    id="sym"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                    placeholder="BTCUSDT"
                    className="font-mono"
                  />
                  {currentPrice !== null && (
                    <p className="text-xs text-muted-foreground">
                      Current: <span className="text-foreground font-semibold tabular-nums">${formatPrice(currentPrice)}</span>
                    </p>
                  )}
                </div>
                {/* Condition */}
                <div className="space-y-1.5">
                  <Label>Condition</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCondition("above")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors",
                        condition === "above"
                          ? "border-bull bg-bull/10 text-bull"
                          : "border-border text-muted-foreground hover:border-border"
                      )}
                    >
                      <ArrowUp className="h-4 w-4" /> Above
                    </button>
                    <button
                      type="button"
                      onClick={() => setCondition("below")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors",
                        condition === "below"
                          ? "border-bear bg-bear/10 text-bear"
                          : "border-border text-muted-foreground hover:border-border"
                      )}
                    >
                      <ArrowDown className="h-4 w-4" /> Below
                    </button>
                  </div>
                </div>
                {/* Target */}
                <div className="space-y-1.5">
                  <Label htmlFor="target">Target price (USD)</Label>
                  <Input
                    id="target"
                    type="number"
                    step="any"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    placeholder={currentPrice ? String(Math.round(currentPrice * 0.99)) : "70000"}
                    className="font-mono"
                  />
                  {currentPrice !== null && target && (
                    <p className="text-xs text-muted-foreground">
                      {parseFloat(target) > currentPrice
                        ? `+${(((parseFloat(target) - currentPrice) / currentPrice) * 100).toFixed(2)}% above current`
                        : `${(((parseFloat(target) - currentPrice) / currentPrice) * 100).toFixed(2)}% below current`}
                    </p>
                  )}
                </div>
                {/* Note */}
                <div className="space-y-1.5">
                  <Label htmlFor="note">Note (optional)</Label>
                  <Input
                    id="note"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. Resistance level, DCA entry..."
                  />
                </div>
                <Button onClick={save} className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                  Create alert
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Push permission banner */}
      {pushStatus === "denied" && (
        <Card className="p-4 border-bear/30 bg-bear/5 flex items-center gap-3">
          <Bell className="h-5 w-5 text-bear shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-bear">Push notifications blocked</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              To receive phone notifications, enable them in your browser settings → Site permissions → Notifications
            </p>
          </div>
        </Card>
      )}

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Active <Badge variant="secondary" className="ml-1.5 text-xs">{activeAlerts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="paused">
            Paused <Badge variant="secondary" className="ml-1.5 text-xs">{inactiveAlerts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history">
            History <Badge variant="secondary" className="ml-1.5 text-xs">{history.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Active */}
        <TabsContent value="active">
          <AlertList
            items={activeAlerts}
            livePrices={livePrices}
            onToggle={toggleActive}
            onRemove={remove}
          />
        </TabsContent>

        {/* Paused */}
        <TabsContent value="paused">
          <AlertList
            items={inactiveAlerts}
            livePrices={livePrices}
            onToggle={toggleActive}
            onRemove={remove}
          />
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          {history.length === 0 ? (
            <Card className="p-12 text-center border-dashed bg-gradient-card">
              <History className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No alerts have triggered yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Triggered alerts will appear here automatically.</p>
            </Card>
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <Button variant="ghost" size="sm" onClick={clearHistory} className="text-muted-foreground hover:text-bear">
                  Clear history
                </Button>
              </div>
              <Card className="bg-gradient-card divide-y divide-border">
                {history.map(h => {
                  const wentUp = h.triggered_price > h.target_price;
                  const diff = (((h.triggered_price - h.target_price) / h.target_price) * 100);
                  return (
                    <div key={h.id} className="flex items-center justify-between p-4 gap-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                          h.condition === "above" ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"
                        )}>
                          {h.condition === "above" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-mono font-semibold text-sm">{h.symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            Target: <span className="text-foreground font-semibold">${formatPrice(Number(h.target_price))}</span>
                            {" · "}Fired: <span className={cn("font-semibold", wentUp ? "text-bull" : "text-bear")}>
                              ${formatPrice(Number(h.triggered_price))}
                            </span>
                            {" "}
                            <span className="text-muted-foreground">({diff >= 0 ? "+" : ""}{diff.toFixed(2)}%)</span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            {h.email_status && (
                              <Badge variant={h.email_status === "sent" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                ✉ {h.email_status}
                              </Badge>
                            )}
                            {h.push_status && (
                              <Badge variant={h.push_status === "sent" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                🔔 {h.push_status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0 text-right">
                        {new Date(h.triggered_at).toLocaleDateString()}<br />
                        {new Date(h.triggered_at).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })}
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertList({
  items,
  livePrices,
  onToggle,
  onRemove,
}: {
  items: Alert[];
  livePrices: Map<string, number>;
  onToggle: (id: string, current: boolean) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed bg-gradient-card">
        <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No alerts here.</p>
        <p className="text-sm text-muted-foreground mt-1">Create one with <strong>New alert</strong>.</p>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card divide-y divide-border">
      {items.map(a => {
        const live = livePrices.get(a.symbol);
        const target = Number(a.target_price);
        const pctToTarget = live ? (((target - live) / live) * 100) : null;
        const isClose = pctToTarget !== null && Math.abs(pctToTarget) < 1;

        return (
          <div key={a.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                a.condition === "above" ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"
              )}>
                {a.condition === "above" ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{a.symbol}</span>
                  {isClose && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning text-warning animate-pulse">
                      CLOSE
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {a.condition}{" "}
                  <span className="tabular-nums font-semibold text-foreground">${formatPrice(target)}</span>
                  {live && (
                    <span className="ml-2 text-xs">
                      now: <span className="text-foreground font-mono">${formatPrice(live)}</span>
                      {pctToTarget !== null && (
                        <span className={cn("ml-1", pctToTarget >= 0 ? "text-bull" : "text-bear")}>
                          ({pctToTarget >= 0 ? "+" : ""}{pctToTarget.toFixed(2)}%)
                        </span>
                      )}
                    </span>
                  )}
                  {a.note && <span className="ml-2 text-xs opacity-60">• {a.note}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Switch
                checked={a.is_active}
                onCheckedChange={() => onToggle(a.id, a.is_active)}
              />
              <Button variant="ghost" size="icon" onClick={() => onRemove(a.id)}>
                <Trash2 className="h-4 w-4 text-bear" />
              </Button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
