import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { startAlertEngine, stopAlertEngine } from "@/lib/alertEngine";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = useAuth();
  const engineStarted = useRef(false);

  useEffect(() => {
    if (!user || engineStarted.current) return;
    engineStarted.current = true;
    startAlertEngine(user.id);
    return () => {
      stopAlertEngine();
      engineStarted.current = false;
    };
  }, [user]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
