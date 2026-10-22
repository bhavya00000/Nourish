export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="min-h-dvh grid place-items-center px-6 text-center">
      <div className="space-y-2 max-w-sm">
        <h1 className="text-lg font-semibold tracking-tight">You are offline</h1>
        <p className="text-[13.5px] text-muted text-pretty">
          Nourish needs a connection to save what you eat. Anything already loaded is still readable — reconnect and
          your next entry will go through.
        </p>
      </div>
    </div>
  );
}
