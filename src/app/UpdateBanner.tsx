import { useEffect, useState } from "react";
import { CircleArrowDown, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { desktopAvailable } from "../infrastructure/desktop";
import { findUpdate, installUpdate, type DownloadProgress, type Update } from "../infrastructure/updates";

// The check waits for the launch animation, so the news never lands on the splash.
const CHECK_DELAY_MS = 1600;
const megabytes = (bytes: number) => Math.round(bytes / 1e6).toLocaleString("en-US") + " MB";
/** The release notes' first real line: GitHub notes are Markdown and usually start with a heading. */
const headline = (notes?: string) =>
  notes?.split("\n").map(line => line.replace(/^[#>*\-\s]+/, "").trim()).find(Boolean) ?? "";

type Phase = "available" | "downloading" | "installing" | "failed";

/**
 * Drops from the top of the window when GitHub lists a newer signed release. Installing
 * downloads the installer, checks its signature against the public key built into the app
 * and runs it; Windows then closes the app and the installer reopens the new version.
 */
export function UpdateBanner({ busy, beforeInstall }: { busy: boolean; beforeInstall: () => Promise<boolean> }) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [phase, setPhase] = useState<Phase>("available");
  const [progress, setProgress] = useState<DownloadProgress>({ downloaded: 0, total: null });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!desktopAvailable()) return;
    let current = true;
    // Offline or GitHub unreachable: stay quiet and check again next launch.
    const timer = setTimeout(() => findUpdate().then(found => { if (current) setUpdate(found); }).catch(() => {}), CHECK_DELAY_MS);
    return () => { current = false; clearTimeout(timer); };
  }, []);
  if (!update) return null;

  const install = async () => {
    if (!await beforeInstall()) return;
    setPhase("downloading");
    setError("");
    try {
      await installUpdate(update, next => {
        setProgress(next);
        if (next.total !== null && next.downloaded >= next.total) setPhase("installing");
      });
      setPhase("installing");
    } catch (failure) {
      setError(String(failure).replace(/^Error: /, ""));
      setPhase("failed");
    }
  };
  const percent = progress.total ? Math.min(100, Math.round(progress.downloaded / progress.total * 100)) : null;
  const title = phase === "failed" ? "The update didn't install"
    : phase === "installing" ? `Installing manim-editor ${update.version}…`
    : `manim-editor ${update.version} is available`;
  const detail = phase === "failed" ? error
    : phase === "installing" ? "manim-editor closes now and reopens on the new version."
    : phase === "downloading" ? `Downloading… ${percent === null ? megabytes(progress.downloaded)
      : `${percent}% · ${megabytes(progress.downloaded)} of ${megabytes(progress.total!)}`}`
    : [`You have ${update.currentVersion}.`, headline(update.body), busy && "It can install once Manim finishes."].filter(Boolean).join(" ");
  const settled = phase === "available" || phase === "failed";

  return (
    <section className="update-banner shadow-lg" aria-label="Update" aria-live="polite" data-leaving={leaving || undefined}
      onTransitionEnd={event => { if (leaving && event.target === event.currentTarget) setUpdate(null); }}
      onKeyDown={event => { if (event.key === "Escape" && settled) setLeaving(true); }}>
      <span className="update-icon" aria-hidden="true"><CircleArrowDown /></span>
      <div className="update-text">
        <p className="update-title">{title}</p>
        <p className="update-detail">{detail}</p>
        {phase === "downloading" && <Progress value={percent ?? 0} className="mt-2 h-1.5" aria-label="Update download" />}
      </div>
      {settled && <div className="update-actions">
        <Button variant="ghost" size="sm" onClick={() => setLeaving(true)}>Later</Button>
        <Button size="sm" className="bg-foreground font-semibold text-background hover:bg-foreground/90" disabled={busy} onClick={() => void install()}>
          {phase === "failed" ? <><RotateCw />Try again</> : "Update and restart"}
        </Button>
      </div>}
    </section>
  );
}
