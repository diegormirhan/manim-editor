import { useEffect, useRef, useState } from "react";
import type { Project } from "../domain/project";
import type { Box } from "../domain/placement";
import { liveFrame } from "../infrastructure/desktop";

/**
 * Manim's own frame of the project at the playhead, while `enabled`, with where each element
 * on screen sits and the project they show. One request runs at a time; whatever changed
 * meanwhile waits as a single latest request, so scrubbing and typing never queue up stale frames.
 */
export function useLiveFrame(project: Project, timeMs: number, enabled: boolean) {
  const [shown, setShown] = useState<{ frame: string; boxes: Record<string, Box>; source: Project | null }>({ frame: "", boxes: {}, source: null });
  const [error, setError] = useState("");
  const next = useRef<{ project: Project; timeMs: number } | null>(null);
  const busy = useRef(false);
  const pump = useRef(async () => {
    if (busy.current || !next.current) return;
    const request = next.current;
    next.current = null;
    busy.current = true;
    try {
      const { frame, boxes } = await liveFrame(request.project, request.timeMs);
      setShown({ frame: "data:image/png;base64," + frame, boxes, source: request.project });
      setError("");
    } catch (failure) {
      setError(String(failure).replace(/^Error: /, ""));
    } finally {
      busy.current = false;
      void pump.current();
    }
  });
  useEffect(() => {
    if (!enabled) return;
    next.current = { project, timeMs };
    void pump.current();
  }, [project, timeMs, enabled]);
  return { ...shown, error };
}
