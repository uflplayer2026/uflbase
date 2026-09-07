import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Shows a discreet banner when the device is offline — no fake offline data is served. */
export function OfflineNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-destructive/15 px-4 py-2 text-center text-xs text-destructive"
    >
      <WifiOff className="size-3.5" aria-hidden />
      You are offline — the latest card data requires a connection.
    </div>
  );
}
