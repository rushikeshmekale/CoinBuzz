import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, LineChart, Newspaper, Zap, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fetchTickers, formatPct, formatPrice, type Ticker } from "@/lib/prices";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Landing,
});

const HERO_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

function Landing() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tickers, setTickers] = useState<Ticker[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => fetchTickers(HERO_SYMBOLS).then(t => alive && setTickers(t)).catch(() => {});
    load();
    const id = window.setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Button onClick={() => nav({ to: "/dashboard" })}>Open app</Button>
            ) : (
              <>
                <Button variant="ghost" asChild><Link to="/login">Sign in</Link></Button>
                <Button asChild><Link to="/signup">Get started</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
                Live • 24/7 market monitoring
              </div>
              <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight lg:text-7xl">
                Never miss a <span className="bg-gradient-primary bg-clip-text text-transparent">price move</span> again.
              </h1>
              <p className="mt-5 text-lg text-muted-foreground lg:text-xl">
                CoinBuzz watches crypto and forex markets while you sleep. The moment a price crosses your threshold, you get a push notification and email — instantly.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                  <Link to="/signup">
                    Start tracking free <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
              <div className="mt-6 flex items-center gap-5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> No credit card</span>
                <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Sub-minute alerts</span>
              </div>
            </div>

            {/* Live ticker card */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-primary opacity-20 blur-3xl" />
              <div className="relative rounded-2xl border border-border bg-card p-5 shadow-elegant">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live prices</div>
                  <div className="flex items-center gap-1.5 text-xs text-bull">
                    <span className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse" /> Streaming
                  </div>
                </div>
                <div className="space-y-2">
                  {HERO_SYMBOLS.map(sym => {
                    const t = tickers.find(x => x.symbol === sym);
                    const up = (t?.change24h ?? 0) >= 0;
                    return (
                      <div key={sym} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3">
                        <div>
                          <div className="font-mono text-sm font-semibold">{sym.replace("USDT", "")}</div>
                          <div className="text-xs text-muted-foreground">USDT</div>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-lg font-bold tabular-nums">${t ? formatPrice(t.price) : "—"}</div>
                          <div className={cn("text-xs font-semibold tabular-nums", up ? "text-bull" : "text-bear")}>
                            {t ? formatPct(t.change24h) : "—"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold lg:text-4xl">Built for traders who don't want to stare at charts.</h2>
            <p className="mt-3 text-muted-foreground">Set it once. Get notified the second it matters.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Bell, title: "Smart alerts", desc: "Above / below targets fire instantly across email and browser push — no app required." },
              { icon: LineChart, title: "Live charts", desc: "Beautiful candlestick & area charts for every symbol you watch. 1H to 1M timeframes." },
              { icon: Newspaper, title: "Market news", desc: "Curated headlines and an economic calendar so you know what's moving the market." },
              { icon: Smartphone, title: "Watch from anywhere", desc: "Works on every device. Push notifications fire even when the tab is closed." },
              { icon: Zap, title: "Real-time prices", desc: "WebSocket-streamed prices from Binance — sub-second updates." },
              { icon: ShieldCheck, title: "Your data, secured", desc: "Bank-grade encryption. Row-level security. Only you see your alerts." },
            ].map(f => (
              <div key={f.title} className="rounded-xl border border-border bg-gradient-card p-5 hover:border-primary/40 transition-colors">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-gradient-hero">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center lg:px-8">
          <h2 className="font-display text-4xl font-bold lg:text-5xl">Ready to catch the next move?</h2>
          <p className="mt-4 text-muted-foreground">Set up your first alert in under 60 seconds.</p>
          <Button size="lg" asChild className="mt-8 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            <Link to="/signup">Create free account <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CoinBuzz. Prices via Binance. Not financial advice.
      </footer>
    </div>
  );
}
