import type { ComponentProps, ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

/** A shadcn tooltip naming the control and, when it has one, its shortcut. */
export function Hint({ label, keys, side, children }: {
  label: string; keys?: string; side?: ComponentProps<typeof TooltipContent>["side"]; children: ReactElement;
}) {
  return <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={side} className="flex items-center gap-2">
      {label}
      {keys && <KbdGroup>{keys.split("+").map(key => <Kbd key={key}>{key}</Kbd>)}</KbdGroup>}
    </TooltipContent>
  </Tooltip>;
}
