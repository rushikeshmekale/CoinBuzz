import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Bell, Star, Newspaper, Settings, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { signOut, user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="px-5 py-5 border-b border-sidebar-border">
            <Link to="/dashboard">
              <Logo />
            </Link>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV.map((item) => {
              const active = loc.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-primary shadow-glow"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-sidebar-border p-3 space-y-2">
            <div className="px-2 py-1 text-xs text-muted-foreground truncate">{user?.email}</div>
            {/* Desktop sign out — subtle */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 hidden lg:flex"
              onClick={async () => {
                await signOut();
                nav({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
            {/* Mobile sign out — red, prominent */}
            <button
              className="lg:hidden w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors"
              style={{
                background: "rgba(239,68,68,0.12)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.3)",
                cursor: "pointer",
              }}
              onClick={async () => {
                setOpen(false);
                await signOut();
                nav({ to: "/" });
              }}
            >
              <LogOut style={{ width: 16, height: 16 }} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:px-8">
          <button
            className="lg:hidden"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "36px",
              width: "36px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #4ade80, #22c55e)",
              color: "#000",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
            }}
            onClick={() => setOpen((o) => !o)}
          >
            <Menu style={{ width: 16, height: 16 }} />
          </button>
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
