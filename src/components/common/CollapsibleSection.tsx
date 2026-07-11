"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * CollapsibleSection per PPM design system section 5.6.
 *
 * Tonal section grouping with an opinionated header bar. Use to group risks
 * (red), pending items (amber), completed (green), info (blue), etc. State
 * persists in localStorage under `${storageKey}:${id}` like CollapsibleCard.
 */

type Tone =
  | "neutral"
  | "red"
  | "amber"
  | "green"
  | "blue"
  | "purple"
  | "slate";

interface CollapsibleSectionProps {
  id: string;
  title: ReactNode;
  count?: number;
  tone?: Tone;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  className?: string;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-text-primary border-border",
  red: "bg-red-50 text-red-800 border-red-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  green: "bg-green-50 text-green-800 border-green-200",
  blue: "bg-blue-50 text-blue-800 border-blue-200",
  purple: "bg-purple-50 text-purple-800 border-purple-200",
  slate: "bg-slate-50 text-slate-800 border-slate-200",
};

const DEFAULT_STORAGE_KEY = "solution-studio:collapsible-section";

export function CollapsibleSection({
  id,
  title,
  count,
  tone = "neutral",
  actions,
  children,
  defaultOpen = true,
  storageKey = DEFAULT_STORAGE_KEY,
  className,
}: CollapsibleSectionProps) {
  const fullKey = `${storageKey}:${id}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(fullKey);
    if (stored === "1") setOpen(true);
    else if (stored === "0") setOpen(false);
  }, [fullKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(fullKey, next ? "1" : "0");
    }
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-white shadow-card overflow-hidden",
        className
      )}
    >
      <div
        className={cn(
          "w-full flex items-center gap-2 px-4 py-2.5 text-body-sm font-semibold transition-colors",
          open ? "border-b" : "",
          TONE_CLASSES[tone]
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={`${fullKey}-body`}
          className="inline-flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <ChevronDown
            size={14}
            className={cn("transition-transform shrink-0", open ? "" : "-rotate-90")}
          />
          <span className="flex-1 truncate">{title}</span>
          {typeof count === "number" && (
            <span className="text-[11px] font-medium opacity-80 tabular-nums">
              {count}
            </span>
          )}
        </button>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      {open && (
        <div id={`${fullKey}-body`} className="p-4 bg-white">
          {children}
        </div>
      )}
    </section>
  );
}
