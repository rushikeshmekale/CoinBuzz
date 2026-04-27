import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchTickers, formatPct, formatPrice, searchSymbols, streamTickers, type Ticker } from "@/lib/prices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/watchlist")({
  component: WatchlistPage,
});

type Item = { id: string; symbol: string };

function WatchlistPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("watchlist").select("id, symbol").eq("user_id", user.id).order("position");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    const syms = items.map(i => i.symbol);
    if (syms.length === 0) { setTickers({}); return; }
    fetchTickers(syms).then(list => {
      const m: Record<string, Ticker> = {};
      list.forEach(t => { m[t.symbol] = t; });
      setTickers(m);
    }).catch(() => {});
    const stop = streamTickers(syms, (tick) => {
      setTickers(prev => ({
        ...prev,
        [tick.symbol]: { ...(prev[tick.symbol] ?? { symbol: tick.symbol, price: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0 }), price: tick.price, change24h: tick.change24h }
      }));
    });
    return () => stop();
  }, [items.map(i => i.symbol).join(",")]);

  useEffect(() => {
    const t = setTimeout(() => { if (query.length >= 2) searchSymbols(query).then(setResults); else setResults([]); }, 200);
    return () => clearTimeout(t);
  }, [query]);

  async function add(symbol: string) {
    if (!user) return;
    const { error } = await supabase.from("watchlist").insert({ user_id: user.id, symbol, asset_type: "crypto", position: items.length });
    if (error) { toast.error(error.message.includes("duplicate") ? "Already in watchlist" : error.message); return; }
    toast.success(`Added ${symbol}`);
    setOpen(false); setQuery(""); load();
  }

  async function remove(id: string, symbol: string) {
    await supabase.from("watchlist").delete().eq("id", id);
    toast.success(`Removed ${symbol}`);
    load();
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold lg:text-4xl">Watchlist</h1>
          <p className="text-muted-foreground mt-1">Symbols you're tracking. Live prices update in real time.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
              <Plus className="h-4 w-4 mr-1" /> Add symbol
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add to watchlist</DialogTitle></DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="BTC, ETH, SOL…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
            </div>
            <div className="max-h-72 overflow-auto space-y-1">
              {results.length === 0 && query.length >= 2 && <p className="text-sm text-muted-foreground p-2">No symbols found.</p>}
              {results.map(s => (
                <button key={s} onClick={() => add(s)} className="w-full text-left rounded-md border border-border bg-card hover:bg-accent/30 px-3 py-2 font-mono text-sm">
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Crypto only for now. Forex/stocks coming once Twelve Data API key is added in Settings.</p>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-dashed">
          <p className="text-muted-foreground">Your watchlist is empty. Click <strong>Add symbol</strong> to get started.</p>
        </Card>
      ) : (
        <Card className="bg-gradient-card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Symbol</div>
            <div className="text-right">Price</div>
            <div className="text-right hidden sm:block">24h</div>
            <div className="text-right hidden sm:block">Volume</div>
            <div />
          </div>
          {items.map(it => {
            const t = tickers[it.symbol];
            const up = (t?.change24h ?? 0) >= 0;
            return (
              <div key={it.id} className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-3 border-b border-border last:border-b-0 hover:bg-accent/10 transition-colors">
                <div className="font-mono font-semibold">{it.symbol}</div>
                <div className="text-right tabular-nums font-display font-semibold">${t ? formatPrice(t.price) : "—"}</div>
                <div className={cn("text-right tabular-nums font-semibold hidden sm:block", up ? "text-bull" : "text-bear")}>{t ? formatPct(t.change24h) : "—"}</div>
                <div className="text-right tabular-nums text-sm text-muted-foreground hidden sm:block">${t ? formatPrice(t.volume24h) : "—"}</div>
                <Button variant="ghost" size="icon" onClick={() => remove(it.id, it.symbol)}>
                  <Trash2 className="h-4 w-4 text-bear" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
