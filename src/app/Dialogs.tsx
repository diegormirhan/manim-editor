import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

export type ConfirmRequest = { title: string; message: string; confirm: string };

/** Asked only when work would be lost; Cancel takes the focus. */
export function ConfirmDialog({ request, onAnswer }: { request: ConfirmRequest | null; onAnswer: (confirmed: boolean) => void }) {
  return <AlertDialog open={!!request} onOpenChange={open => { if (!open) onAnswer(false); }}>
    <AlertDialogContent size="sm" className="sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>{request?.title}</AlertDialogTitle>
        <AlertDialogDescription>{request?.message}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
        <AlertDialogAction size="sm" variant="destructive" onClick={() => onAnswer(true)}>{request?.confirm}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

const SHORTCUTS: [string, [string, string][]][] = [
  ["Project", [["Ctrl N", "New project"], ["Ctrl O", "Open"], ["Ctrl S", "Save"], ["Ctrl Shift S", "Save as"],
    ["Ctrl Z", "Undo"], ["Ctrl Y", "Redo"], ["Ctrl ,", "Settings"]]],
  ["Render and export", [["Ctrl Enter", "Render the preview"], ["Ctrl Shift E", "Export video"], ["Ctrl E", "Export Python"],
    ["Esc", "Cancel a render or export"]]],
  ["Playback", [["Space", "Play or pause"], ["← →", "Previous or next frame"], ["Shift ← →", "One second back or forward"],
    ["Home End", "Scene start or end"], ["= −", "Zoom the timeline in or out"], ["\\", "Fit the scene"],
    ["Ctrl Wheel", "Zoom at the pointer"]]],
  ["Editing", [["Ctrl D", "Duplicate object"], ["Delete", "Remove the selected object or animation"],
    ["← →", "Move a focused clip by 0.1 s"], ["Shift ← →", "Resize a focused clip's end"], ["Esc", "Cancel a drag"],
    ["Alt Drag", "Drag with snapping inverted"]]],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Shortcuts work anywhere except while you type in a field.</DialogDescription>
      </DialogHeader>
      <div className="shortcut-groups">{SHORTCUTS.map(([group, rows]) => <section key={group}>
        <h3>{group}</h3>
        <dl>{rows.map(([keys, action]) => <div key={group + keys}>
          <dt><KbdGroup>{keys.split(" ").map(key => <Kbd key={key}>{key}</Kbd>)}</KbdGroup></dt><dd>{action}</dd>
        </div>)}</dl>
      </section>)}</div>
    </DialogContent>
  </Dialog>;
}
