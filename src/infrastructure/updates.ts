import { check, type Update } from "@tauri-apps/plugin-updater";

export type { Update };
export type DownloadProgress = { downloaded: number; total: number | null };

/** The newer signed release listed in the GitHub manifest, or null when this version is current. */
export const findUpdate = () => check();

/** Downloads the installer, verifies its signature and runs it; on Windows the app then closes. */
export function installUpdate(update: Update, onProgress: (progress: DownloadProgress) => void) {
  let downloaded = 0, total: number | null = null;
  return update.downloadAndInstall(event => {
    if (event.event === "Started") total = event.data.contentLength ?? null;
    else if (event.event === "Progress") downloaded += event.data.chunkLength;
    onProgress({ downloaded, total });
  });
}
