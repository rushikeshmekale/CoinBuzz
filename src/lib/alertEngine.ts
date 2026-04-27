/**
 * CoinBuzz Alert Engine
 * 
 * Runs inside the browser using Binance WebSocket.
 * - Polls all active alert symbols via WebSocket stream
 * - When price crosses threshold: marks alert triggered, writes history, fires notification
 * - Alert is DELETED from active after triggering (one-shot)
 * - Sends browser push notification immediately
 * - Calls edge function to send email (if user has notify_email=true)
 */

import { supabase } from "@/integrations/supabase/client";
import { streamTickers } from "@/lib/prices";
import { showLocalNotification, registerSW } from "@/lib/pushNotifications";

type AlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  condition: "above" | "below";
  target_price: number;
  is_active: boolean;
  note: string | null;
};

type PriceMap = Map<string, number>;

let stopStream: (() => void) | null = null;
let checkInterval: ReturnType<typeof setInterval> | null = null;
let activeAlerts: AlertRow[] = [];
const latestPrices: PriceMap = new Map();
// Track which alerts we've already fired to prevent double-trigger
const firedAlerts = new Set<string>();

export async function startAlertEngine(userId: string) {
  await stopAlertEngine();
  await registerSW();
  await loadAlerts(userId);
  subscribeToAlertChanges(userId);
  startPriceStream();
}

export async function stopAlertEngine() {
  if (stopStream) { stopStream(); stopStream = null; }
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  firedAlerts.clear();
}

async function loadAlerts(userId: string) {
  const { data } = await supabase
    .from("alerts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);
  activeAlerts = (data ?? []) as AlertRow[];
}

// Realtime subscription — when alerts table changes, reload
function subscribeToAlertChanges(userId: string) {
  supabase
    .channel("alert-engine-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "alerts", filter: `user_id=eq.${userId}` },
      () => { loadAlerts(userId); }
    )
    .subscribe();
}

function getSymbols(): string[] {
  const syms = [...new Set(activeAlerts.map(a => a.symbol))];
  return syms;
}

function startPriceStream() {
  const symbols = getSymbols();
  if (symbols.length === 0) return;

  stopStream = streamTickers(symbols, ({ symbol, price }) => {
    latestPrices.set(symbol, price);
    checkAlerts(symbol, price);
  });

  // Re-subscribe every 5 minutes to pick up new alerts / symbols
  checkInterval = setInterval(async () => {
    if (stopStream) { stopStream(); stopStream = null; }
    const newSymbols = getSymbols();
    if (newSymbols.length > 0) {
      stopStream = streamTickers(newSymbols, ({ symbol, price }) => {
        latestPrices.set(symbol, price);
        checkAlerts(symbol, price);
      });
    }
  }, 5 * 60 * 1000);
}

async function checkAlerts(symbol: string, price: number) {
  const triggered = activeAlerts.filter(a => {
    if (a.symbol !== symbol) return false;
    if (!a.is_active) return false;
    if (firedAlerts.has(a.id)) return false;

    const target = Number(a.target_price);
    if (a.condition === "above" && price >= target) return true;
    if (a.condition === "below" && price <= target) return true;
    return false;
  });

  for (const alert of triggered) {
    // Mark as fired immediately to prevent duplicate triggers
    firedAlerts.add(alert.id);
    await fireAlert(alert, price);
  }
}

async function fireAlert(alert: AlertRow, triggeredPrice: number) {
  try {
    // 1. Write to alert_history
    await supabase.from("alert_history").insert({
      user_id: alert.user_id,
      alert_id: alert.id,
      symbol: alert.symbol,
      condition: alert.condition,
      target_price: Number(alert.target_price),
      triggered_price: triggeredPrice,
      email_status: "pending",
      push_status: "pending",
    });

    // 2. Delete the alert (one-shot — move to history)
    await supabase.from("alerts").delete().eq("id", alert.id);

    // Remove from local state immediately
    activeAlerts = activeAlerts.filter(a => a.id !== alert.id);

    // 3. Local browser push notification (works immediately)
    const dir = alert.condition === "above" ? "▲ above" : "▼ below";
    const priceStr = formatAlertPrice(triggeredPrice);
    const targetStr = formatAlertPrice(Number(alert.target_price));
    const title = `🔔 ${alert.symbol} Alert Triggered`;
    const body = `${alert.symbol} is now $${priceStr} — crossed ${dir} $${targetStr}${alert.note ? ` (${alert.note})` : ""}`;

    await showLocalNotification(title, body, "/alerts");

    // 4. Send email via Supabase Edge Function (non-blocking)
    const { data: profile } = await supabase
      .from("profiles")
      .select("notify_email, display_name")
      .eq("id", alert.user_id)
      .single();

    if (profile?.notify_email) {
      supabase.functions.invoke("send-alert-email", {
        body: {
          userId: alert.user_id,
          symbol: alert.symbol,
          condition: alert.condition,
          targetPrice: Number(alert.target_price),
          triggeredPrice,
          note: alert.note,
          displayName: profile.display_name,
        }
      }).catch(console.warn);
    }

  } catch (e) {
    console.error("Alert fire failed:", e);
    firedAlerts.delete(alert.id); // allow retry
  }
}

function formatAlertPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(8);
}
