import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "uflbase.install-prompt.dismissed.v1";

/**
 * Non-intrusive install invitation. Only renders when the browser actually
 * fires `beforeinstallprompt` (so never a broken button), never when the app is
 * already installed, and never again after the user dismisses it.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage unavailable — still allow the prompt */
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!event) return;
    setVisible(false);
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setEvent(null);
  }

  if (!visible || !event) return null;

  return (
    <div className="install-prompt" role="dialog" aria-labelledby="install-prompt-title">
      <div className="min-w-0">
        <p id="install-prompt-title" className="text-sm font-semibold">
          Install UFLBase
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add UFLBase to your home screen for a faster app-like experience.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" className="btn-primary focus-ring" onClick={install}>
          <Download className="size-4" aria-hidden /> Install
        </button>
        <button type="button" className="btn-secondary focus-ring" onClick={dismiss}>
          <X className="size-4 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">Not now</span>
          <span className="sr-only">Not now</span>
        </button>
      </div>
    </div>
  );
}
