# CoinBuzz — Production Setup Guide

## What's in this build

- ✅ Alert engine using Binance WebSocket — triggers the INSTANT price crosses threshold
- ✅ Triggered alerts → deleted from active → moved to History automatically  
- ✅ Browser & phone push notifications (even when tab is closed) via Service Worker
- ✅ Email alerts via Supabase Edge Function + Resend
- ✅ Login with Google, GitHub, or Email/Password
- ✅ Live prices shown on each alert card (how far from trigger)
- ✅ Dark/light mode fixed

---

## Step 1 — Install and run

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Step 2 — Enable Google + GitHub login in Supabase

### Google OAuth
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project → APIs & Services → Credentials → Create OAuth 2.0 Client
3. Authorized redirect URI: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret
5. In Supabase → Authentication → Providers → Google → paste Client ID + Secret → Save

### GitHub OAuth  
1. Go to [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App
2. Homepage URL: your app URL
3. Callback URL: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret
5. In Supabase → Authentication → Providers → GitHub → paste Client ID + Secret → Save

---

## Step 3 — Set up email alerts (Resend — free)

1. Sign up at [resend.com](https://resend.com) — free 3,000 emails/month
2. Get your API key from the Resend dashboard
3. In Supabase → Edge Functions → send-alert-email → Settings → add:
   - `RESEND_API_KEY` = your Resend key
   - `APP_URL` = your deployed app URL (or http://localhost:5173)
4. In `supabase/functions/send-alert-email/index.ts` line 49, change the `from` address:
   - `from: "CoinBuzz Alerts <alerts@yourdomain.com>"` 
   - For testing without a domain use: `from: "CoinBuzz <onboarding@resend.dev>"`
5. Deploy the edge function:
   ```bash
   npx supabase functions deploy send-alert-email
   ```

---

## Step 4 — Enable browser/phone push notifications

Push notifications work automatically when the user clicks "Enable push" in:
- Alerts page (banner button)  
- Settings page (Notifications section)

**For phone notifications when browser is closed** (optional, advanced):
1. Generate VAPID keys: go to https://www.web-push-codelab.glitch.me/ → click Generate
2. Copy the Public Key → add to `.env`: `VITE_VAPID_PUBLIC_KEY=your_public_key`
3. Without VAPID keys, push notifications still work when the browser is open

---

## Step 5 — Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add environment variables when prompted, OR go to Vercel dashboard → Settings → Environment Variables:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY  
# VITE_NEWS_API_KEY (optional)
# VITE_VAPID_PUBLIC_KEY (optional)

# After first deploy, set production URL:
vercel --prod
```

After deploying, update Supabase:
1. Authentication → URL Configuration → Site URL = your Vercel URL
2. Add redirect URL: `https://your-app.vercel.app/dashboard`
3. Update Google/GitHub OAuth callback if you changed the domain

---

## How the alert engine works

```
User creates alert in DB
        ↓
AlertEngine.ts starts Binance WebSocket stream
        ↓  
Price tick arrives (every ~100ms via WebSocket)
        ↓
checkAlerts() — compares price to each active alert
        ↓
If condition met (price >= target for "above", price <= target for "below"):
  1. Write row to alert_history table
  2. DELETE the alert from alerts table (one-shot, no re-trigger)
  3. Show browser push notification immediately
  4. Call Edge Function → send email (if notify_email=true)
        ↓
Alerts page updates via Supabase Realtime subscription
```

---

## File structure

```
src/
├── lib/
│   ├── alertEngine.ts      ← THE brain — WebSocket price monitoring + trigger logic
│   ├── pushNotifications.ts ← Service Worker registration + notification helpers
│   ├── prices.ts           ← Binance REST + WebSocket
│   ├── auth.tsx            ← Auth context (email + OAuth)
│   └── theme.tsx           ← Dark/light mode
├── routes/
│   ├── login.tsx           ← Email + Google + GitHub login
│   ├── signup.tsx          ← Email + Google + GitHub signup
│   ├── _app.tsx            ← Starts alert engine after login
│   ├── _app.alerts.tsx     ← Alerts page with live prices + history
│   └── _app.settings.tsx   ← Push notification controls + integrations
public/
└── sw.js                   ← Service Worker (handles push when browser closed)
supabase/
└── functions/
    └── send-alert-email/
        └── index.ts        ← Edge function — sends email via Resend
```
