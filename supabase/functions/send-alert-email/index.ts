// Supabase Edge Function — sends email when a price alert triggers
// Deploy: supabase functions deploy send-alert-email
// Env vars needed in Supabase dashboard: RESEND_API_KEY, APP_URL

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://coinbuzz.vercel.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      userId,
      symbol,
      condition,
      targetPrice,
      triggeredPrice,
      note,
      displayName,
    } = await req.json();

    if (!userId || !symbol) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email from Supabase auth
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user } } = await admin.auth.admin.getUserById(userId);
    if (!user?.email) throw new Error("User not found");

    const dir = condition === "above" ? "▲ rose above" : "▼ fell below";
    const fmt = (n: number) =>
      n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : n >= 1 ? n.toFixed(4)
      : n.toFixed(8);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>CoinBuzz Alert</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:system-ui,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:0 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:800;color:#4ade80;letter-spacing:-0.5px;">⚡ CoinBuzz</span>
    </div>

    <!-- Card -->
    <div style="background:#1a1f2e;border-radius:16px;overflow:hidden;">
      <!-- Top accent -->
      <div style="height:4px;background:linear-gradient(90deg,#4ade80,#22d3ee);"></div>

      <div style="padding:32px;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Price Alert Triggered</p>
        <h1 style="margin:0 0 24px;font-size:28px;font-weight:700;color:#f0f4ff;">${symbol}</h1>

        <div style="background:#111827;border-radius:12px;padding:20px;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <span style="color:#6b7280;font-size:14px;">Status</span>
            <span style="color:#4ade80;font-weight:600;font-size:14px;">${dir} your target</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <span style="color:#6b7280;font-size:14px;">Your target</span>
            <span style="color:#f0f4ff;font-weight:600;font-size:14px;font-family:monospace;">$${fmt(targetPrice)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;${note ? "margin-bottom:12px;" : ""}">
            <span style="color:#6b7280;font-size:14px;">Triggered at</span>
            <span style="color:#22d3ee;font-weight:700;font-size:16px;font-family:monospace;">$${fmt(triggeredPrice)}</span>
          </div>
          ${note ? `<div style="border-top:1px solid #1f2937;padding-top:12px;margin-top:4px;"><span style="color:#6b7280;font-size:13px;">Note: ${note}</span></div>` : ""}
        </div>

        <a href="${APP_URL}/alerts" style="display:block;text-align:center;background:#4ade80;color:#052e16;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:10px;">
          View Alerts →
        </a>
      </div>

      <!-- Footer -->
      <div style="padding:20px 32px;border-top:1px solid #1f2937;text-align:center;">
        <p style="margin:0;font-size:12px;color:#374151;">
          You're receiving this because you set a price alert on CoinBuzz.<br>
          <a href="${APP_URL}/settings" style="color:#4ade80;text-decoration:none;">Manage notifications</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `CoinBuzz Alert: ${symbol} ${dir} your target of $${fmt(targetPrice)}. Triggered at $${fmt(triggeredPrice)}. View: ${APP_URL}/alerts`;

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CoinBuzz Alerts <onboarding@resend.dev>",
        to: [user.email],
        subject: `🔔 ${symbol} alert triggered — $${fmt(triggeredPrice)}`,
        html,
        text,
      }),
    });

    const resendData = await resendRes.json();

    // Update alert_history email_status
    await admin
      .from("alert_history")
      .update({ email_status: resendRes.ok ? "sent" : "failed" })
      .eq("user_id", userId)
      .eq("symbol", symbol)
      .order("triggered_at", { ascending: false })
      .limit(1);

    return new Response(JSON.stringify({ ok: resendRes.ok, data: resendData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("send-alert-email error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
