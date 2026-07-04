import type { ReactNode } from "react";

/**
 * Small inline callouts usable directly in MDX:
 * <ProTip>Double up on earplugs near the subs.</ProTip>
 * <FieldNote>Loops fogged up once in the rain — dry them off.</FieldNote>
 */

function Callout({
  label,
  icon,
  accent,
  children,
}: {
  label: string;
  icon: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`my-6 rounded-lg border-l-4 bg-zinc-900/50 py-3 pl-4 pr-4 ${accent}`}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest">
        <span aria-hidden className="mr-1">
          {icon}
        </span>
        {label}
      </p>
      <div className="text-sm leading-6 text-zinc-300">{children}</div>
    </div>
  );
}

export function ProTip({ children }: { children: ReactNode }) {
  return (
    <Callout
      label="Pro tip"
      icon="⚡"
      accent="border-fuchsia-500 [&>p:first-child]:text-fuchsia-300"
    >
      {children}
    </Callout>
  );
}

export function FieldNote({ children }: { children: ReactNode }) {
  return (
    <Callout
      label="Field note"
      icon="✎"
      accent="border-cyan-500 [&>p:first-child]:text-cyan-300"
    >
      {children}
    </Callout>
  );
}
