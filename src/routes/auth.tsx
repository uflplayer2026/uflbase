import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin Sign In — UFL Mobile Player Card Database" },
      { name: "description", content: "Administrator sign-in for the UFL Mobile card database." },
      { property: "og:title", content: "Admin Sign In — UFL Mobile Player Card Database" },
      {
        property: "og:description",
        content: "Administrator sign-in for the UFL Mobile card database.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/settings", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/settings", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/settings", replace: true });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="surface-panel text-center">
        <h1 className="text-xl font-bold">Admin sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only the configured administrator Google account can access settings.
        </p>
        <button type="button" className="btn-primary mt-6 w-full" onClick={signIn} disabled={busy}>
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Link to="/" className="mt-5 inline-block text-xs text-muted-foreground hover:underline">
          ← Back to the database
        </Link>
      </div>
    </main>
  );
}
