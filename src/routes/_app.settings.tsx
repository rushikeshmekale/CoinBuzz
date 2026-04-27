import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, Bell, BellOff, Mail, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { requestPushPermission, unsubscribeFromPush } from "@/lib/pushNotifications";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, set } = useTheme();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [newsKey, setNewsKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [pushPerm, setPushPerm] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) setPushPerm(Notification.permission);
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setDisplayName(data.display_name ?? "");
        setNotifyEmail(data.notify_email);
        setNotifyPush(data.notify_push);
      });
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim().slice(0, 60),
        notify_email: notifyEmail,
        notify_push: notifyPush,
        theme,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  }

  async function handlePushToggle() {
    if (pushPerm === "granted") {
      await unsubscribeFromPush();
      setPushPerm("default");
      setNotifyPush(false);
      toast.info("Push notifications disabled");
    } else {
      const perm = await requestPushPermission();
      setPushPerm(perm);
      if (perm === "granted") {
        setNotifyPush(true);
        toast.success("Push notifications enabled!");
      } else if (perm === "denied")
        toast.error("Push blocked. Enable in browser settings → Site permissions.");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-display text-3xl font-bold lg:text-4xl">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your profile, notifications and appearance.
        </p>
      </div>

      {/* Profile */}
      <Card className="p-6 bg-gradient-card space-y-4">
        <h2 className="font-display font-semibold text-lg">Profile</h2>
        <div className="space-y-1.5">
          <Label htmlFor="dn">Display name</Label>
          <Input
            id="dn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled className="opacity-60" />
          <p className="text-xs text-muted-foreground">
            Email is managed through your account credentials.
          </p>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6 bg-gradient-card space-y-5">
        <h2 className="font-display font-semibold text-lg">Notifications</h2>

        {/* Email alerts */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <Label className="font-medium">Email alerts</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Get an email when a price alert fires. Requires Resend API setup.
              </p>
            </div>
          </div>
          <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
        </div>

        {/* Browser / phone push */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <Label className="font-medium">Browser & phone push</Label>
                {pushPerm === "granted" && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-bull">
                    Active
                  </Badge>
                )}
                {pushPerm === "denied" && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-bear">
                    Blocked
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Instant notification on your phone, even when the browser tab is closed.
              </p>
              {pushPerm === "denied" && (
                <p className="text-xs text-bear mt-1">
                  Blocked by browser. Go to browser Settings → Site permissions → Notifications →
                  allow this site.
                </p>
              )}
            </div>
          </div>
          <Button
            variant={pushPerm === "granted" ? "outline" : "default"}
            size="sm"
            onClick={handlePushToggle}
            className={pushPerm === "granted" ? "" : "bg-gradient-primary text-primary-foreground"}
          >
            {pushPerm === "granted" ? (
              <>
                <BellOff className="h-3.5 w-3.5 mr-1.5" />
                Disable
              </>
            ) : (
              <>
                <Bell className="h-3.5 w-3.5 mr-1.5" />
                Enable push
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="p-6 bg-gradient-card space-y-4">
        <h2 className="font-display font-semibold text-lg">Appearance</h2>
        <div className="grid grid-cols-2 gap-3">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => set(t)}
              className={`rounded-lg border-2 p-4 text-left transition-all ${theme === t ? "border-primary" : "border-border hover:border-border/80"}`}
            >
              <div
                className={`h-10 rounded-md border border-border mb-3 ${t === "dark" ? "bg-[oklch(0.16_0.012_240)]" : "bg-[oklch(0.99_0.003_240)]"}`}
              />
              <div className="font-semibold capitalize">{t}</div>
              <div className="text-xs text-muted-foreground">
                {t === "dark" ? "For night-shift traders." : "Crisp daylight mode."}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="p-6 bg-gradient-card border-bear/20 space-y-3">
        <h2 className="font-display font-semibold text-lg text-bear">Danger zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Delete account</p>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account and all data.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => toast.error("Contact support to delete your account.")}
          >
            Delete
          </Button>
        </div>
      </Card>

      {/* Footer / Branding */}
      <Card className="p-6 bg-gradient-card space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left */}
          <div>
            <h3 className="font-display font-semibold text-lg">CoinBuzz</h3>
            <p className="text-sm text-muted-foreground">
              Real-time crypto & forex alert platform.
            </p>
          </div>

          {/* Version */}
          <div className="text-xs text-muted-foreground">v1.0.0 • Beta</div>
        </div>

        <div className="h-px bg-border" />

        {/* Links */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Legal */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <button className="hover:text-primary transition">Privacy Policy</button>
            <button className="hover:text-primary transition">Terms & Conditions</button>
            <button className="hover:text-primary transition">Disclaimer</button>
          </div>

          {/* Social */}
          <div className="flex gap-4 text-sm">
            <a
              href="https://github.com/rushikeshmekale"
              target="_blank"
              className="text-muted-foreground hover:text-primary transition"
            >
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/rushikesh-mekale/"
              target="_blank"
              className="text-muted-foreground hover:text-primary transition"
            >
              LinkedIn
            </a>
          </div>
        </div>

        {/* Credit */}
        <div className="text-center text-xs text-muted-foreground mt-4">
          © {new Date().getFullYear()} CoinBuzz
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center max-w-xl mx-auto">
          This platform provides market data and alerts for informational purposes only. Not
          financial advice. Trading involves risk.
        </p>
      </Card>
      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={saving}
          className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 min-w-[120px]"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
