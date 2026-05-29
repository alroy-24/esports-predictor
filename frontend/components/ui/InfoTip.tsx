"use client";

import * as Tooltip from "@radix-ui/react-tooltip";

/** Accessible hover/focus tooltip (Radix) used to explain SHAP features. */
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 max-w-[220px] rounded-lg border border-white/10 bg-ink-850/95 px-2.5 py-1.5 text-xs text-slate-200 shadow-xl backdrop-blur-xl"
          >
            {label}
            <Tooltip.Arrow className="fill-ink-850" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
