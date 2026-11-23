"use client";

import { Tooltip as Primitive } from "@base-ui/react/tooltip";

export const TooltipProvider = Primitive.Provider;
export const Tooltip = Primitive.Root;
export const TooltipTrigger = Primitive.Trigger;
export function TooltipContent({ children }: { children: React.ReactNode }) {
  return <Primitive.Portal><Primitive.Positioner sideOffset={6} className="z-50"><Primitive.Popup className="max-w-56 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md">{children}</Primitive.Popup></Primitive.Positioner></Primitive.Portal>;
}
