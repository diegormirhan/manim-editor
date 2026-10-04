import { getCurrentWindow } from "@tauri-apps/api/window";

// The window draws its own title bar, so these replace the system caption buttons.
export const minimizeWindow = () => getCurrentWindow().minimize();
export const toggleMaximizeWindow = () => getCurrentWindow().toggleMaximize();
export const closeWindow = () => getCurrentWindow().close();

/** Reports whether the window is maximized now and after every resize; returns the unsubscribe. */
export function watchMaximized(onChange: (maximized: boolean) => void) {
  const appWindow = getCurrentWindow();
  const read = () => { appWindow.isMaximized().then(onChange).catch(() => {}); };
  read();
  const listening = appWindow.onResized(read);
  return () => { void listening.then(unlisten => unlisten()).catch(() => {}); };
}
