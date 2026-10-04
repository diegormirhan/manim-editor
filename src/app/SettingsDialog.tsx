import { useId, type ReactNode } from "react";
import { Clapperboard, Film, MonitorPlay, RotateCcw, SlidersHorizontal, Video } from "lucide-react";
import {
  DEFAULT_SETTINGS, FORMATS, FRAME_RATES, PREVIEW_RESOLUTIONS, RESOLUTIONS, dimensions, formatCodec, formatName,
  outputFrames, supportsTransparency, type Settings,
} from "../domain/render-settings";
import { seconds } from "../domain/timeline";
import type { ThemePreference } from "./useTheme";
import { ColorInput } from "./ElementInspector";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet, FieldTitle,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type SettingsTab = "viewer" | "export" | "scene" | "editor";
const resolutionName = (resolution: string) => (resolution === "2160p" ? "4K" : resolution);

/** A small set of exclusive choices: a segmented control that never ends up empty. */
function Choice<T extends string | number>({ label, value, options, onChange, name = String }: {
  label: string; value: T; options: readonly T[]; onChange: (value: T) => void; name?: (option: T) => string;
}) {
  const id = useId();
  return <Field orientation="horizontal" className="settings-row">
    <FieldContent><FieldTitle id={id}>{label}</FieldTitle></FieldContent>
    <ToggleGroup type="single" variant="outline" size="sm" aria-labelledby={id} value={String(value)}
      onValueChange={next => { const option = options.find(item => String(item) === next); if (option !== undefined) onChange(option); }}>
      {options.map(option => <ToggleGroupItem key={String(option)} value={String(option)} className="px-2.5 tabular-nums">{name(option)}</ToggleGroupItem>)}
    </ToggleGroup>
  </Field>;
}

function Toggle({ label, description, checked, onChange, disabled }: {
  label: string; description: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  const id = useId();
  return <Field orientation="horizontal" className="settings-row" data-disabled={disabled || undefined}>
    <FieldContent>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <FieldDescription>{description}</FieldDescription>
    </FieldContent>
    <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
  </Field>;
}

function Page({ value, title, description, children }: { value: SettingsTab; title: string; description: string; children: ReactNode }) {
  return <TabsContent value={value} className="settings-page">
    <FieldSet>
      <FieldLegend>{title}</FieldLegend>
      <FieldDescription className="-mt-2">{description}</FieldDescription>
      <FieldGroup className="gap-4">{children}</FieldGroup>
    </FieldSet>
  </TabsContent>;
}

export function SettingsDialog({ open, tab, onTab, onClose, settings, onSettings, theme, onTheme, background, onBackground,
  durationMs, onExportVideo, exportDisabled }: {
  open: boolean; tab: SettingsTab; onTab: (tab: SettingsTab) => void; onClose: () => void;
  settings: Settings; onSettings: (patch: Partial<Settings>) => void;
  theme: ThemePreference; onTheme: (theme: ThemePreference) => void;
  background?: string; onBackground: (color: string | undefined) => void;
  durationMs: number; onExportVideo: () => void; exportDisabled: boolean;
}) {
  const { preview, output } = settings;
  const size = dimensions(output.resolution);
  const transparency = supportsTransparency(output.format);
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
      <Tabs orientation="vertical" value={tab} onValueChange={next => onTab(next as SettingsTab)} className="settings gap-0">
        <nav className="settings-nav">
          <DialogTitle className="px-2 text-base">Settings</DialogTitle>
          <DialogDescription className="sr-only">Preview, export, scene and editor preferences.</DialogDescription>
          <TabsList variant="line" className="w-full items-stretch gap-0.5">
            <TabsTrigger value="viewer"><MonitorPlay />Viewer</TabsTrigger>
            <TabsTrigger value="export"><Film />Export</TabsTrigger>
            <TabsTrigger value="scene"><Clapperboard />Scene</TabsTrigger>
            <TabsTrigger value="editor"><SlidersHorizontal />Editor</TabsTrigger>
          </TabsList>
        </nav>

        <Page value="viewer" title="Viewer" description="How Render (Ctrl+Enter) previews the scene inside the editor. Higher settings are sharper and take longer.">
          <Choice label="Preview quality" value={preview.resolution} options={PREVIEW_RESOLUTIONS}
            onChange={resolution => onSettings({ preview: { ...preview, resolution } })} />
          <Choice label="Preview frame rate" value={preview.fps} options={FRAME_RATES} name={fps => `${fps} fps`}
            onChange={fps => onSettings({ preview: { ...preview, fps } })} />
          <FieldSeparator />
          <Toggle label="Play after rendering" description="Start the preview as soon as a render finishes."
            checked={settings.playAfterRender} onChange={playAfterRender => onSettings({ playAfterRender })} />
          <Toggle label="Loop playback" description="Play the preview again from the start when it ends."
            checked={settings.loop} onChange={loop => onSettings({ loop })} />
        </Page>

        <Page value="export" title="Export" description="The video Export → Video… writes to a file you choose.">
          <Choice label="Quality" value={output.resolution} options={RESOLUTIONS} name={resolutionName}
            onChange={resolution => onSettings({ output: { ...output, resolution } })} />
          <Choice label="Frame rate" value={output.fps} options={FRAME_RATES} name={fps => `${fps} fps`}
            onChange={fps => onSettings({ output: { ...output, fps } })} />
          <Choice label="Format" value={output.format} options={FORMATS} name={formatName}
            onChange={format => onSettings({ output: { ...output, format } })} />
          <Toggle label="Transparent background" checked={output.transparent} disabled={!transparency}
            description={transparency ? "Keeps an alpha channel for compositing in a video editor." : "Needs WebM or MOV."}
            onChange={transparent => onSettings({ output: { ...output, transparent } })} />
          <FieldSeparator />
          <div className="settings-summary">
            <p><strong>{size.width} × {size.height}</strong> at {output.fps} fps, {formatName(output.format)} ({formatCodec(output.format)}
              {output.transparent ? " with alpha" : ""}).</p>
            <p className="text-muted-foreground">This {seconds(durationMs)} scene is {outputFrames(durationMs, output.fps).toLocaleString("en-US")} frames.</p>
            <Button variant="outline" size="sm" className="mt-1 w-fit" disabled={exportDisabled} onClick={onExportVideo}><Video />Export video…</Button>
          </div>
        </Page>

        <Page value="scene" title="Scene" description="Saved with this project, so every render and export uses it.">
          <Field orientation="horizontal" className="settings-row">
            <FieldContent>
              <FieldTitle>Background</FieldTitle>
              <FieldDescription>The canvas colour behind every object. Manim's default is black.</FieldDescription>
            </FieldContent>
            <div className="flex items-center gap-2">
              <label className="color-field" aria-label="Background colour">
                <ColorInput value={background ?? "#000000"} onChange={onBackground} />
                <code>{(background ?? "#000000").toUpperCase()}</code>
              </label>
              <Button variant="ghost" size="icon-sm" aria-label="Reset to black" disabled={!background} onClick={() => onBackground(undefined)}>
                <RotateCcw /></Button>
            </div>
          </Field>
          <Field orientation="horizontal" className="settings-row">
            <FieldContent>
              <FieldTitle>Timing grid</FieldTitle>
              <FieldDescription>Clips start and end on 15 fps frames. Higher frame rates add in-between frames without moving them.</FieldDescription>
            </FieldContent>
            <span className="text-muted-foreground tabular-nums">15 fps</span>
          </Field>
        </Page>

        <Page value="editor" title="Editor" description="How this window looks and behaves on this computer.">
          <Choice label="Theme" value={theme} options={["system", "light", "dark"] as ThemePreference[]}
            name={option => option[0].toUpperCase() + option.slice(1)} onChange={onTheme} />
          <FieldSeparator />
          <Toggle label="Snap clips" description="Dragged clips lock onto the playhead, the scene edges and other clips. Hold Alt while dragging to do the opposite."
            checked={settings.snapping} onChange={snapping => onSettings({ snapping })} />
          <Toggle label="Restore unsaved work" description="Reopen the last project after a crash or a closed window."
            checked={settings.restoreSession} onChange={restoreSession => onSettings({ restoreSession })} />
          <FieldSeparator />
          <Button variant="ghost" size="sm" className="w-fit text-muted-foreground"
            onClick={() => { onSettings(DEFAULT_SETTINGS); onTheme("dark"); }}><RotateCcw />Restore default settings</Button>
        </Page>
      </Tabs>
    </DialogContent>
  </Dialog>;
}
