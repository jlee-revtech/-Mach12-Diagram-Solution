"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * CollapsibleCard per PPM design system section 5.6.
 *
 * Open/closed state persists in localStorage under `${storageKey}:${id}` so
 * users get back the same view on reload. Pass `disabled` to render a
 * non-collapsible card (no chevron, no toggle).
 */

interface CollapsibleCardProps {
  id: string;
  title: ReactNode;
  subHeader?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  storageKey?: string;
  className?: string;
}

const DEFAULT_STORAGE_KEY = "solution-studio:collapsible-card";

export function CollapsibleCard({
  id,
  title,
  subHeader,
  actions,
  children,
  defaultOpen = true,
  disabled = false,
  storageKey = DEFAULT_STORAGE_KEY,
  className,
}: CollapsibleCardProps) {
  const fullKey = `${storageKey}:${id}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (disabled || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(fullKey);
    if (stored === "1") setOpen(true);
    else if (stored === "0") setOpen(false);
  }, [disabled, fullKey]);

  function toggle() {
    if (disabled) return;
    const next = !open;
    setOpen(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(fullKey, next ? "1" : "0");
    }
  }

  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-border shadow-card overflow-hidden",
        className
      )}
    >
      <div className="p-5">
        <div className="flex items-start gap-2">
          {!disabled && (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={`${fullKey}-body`}
              className="h-6 w-6 rounded hover:bg-surface-muted text-text-secondary inline-flex items-center justify-center shrink-0"
            >
              <ChevronDown
                size={14}
                className={cn(
                  "transition-transform",
                  open ? "" : "-rotate-90"
                )}
              />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-heading-sm font-display text-text-primary truncate">
                {title}
              </h3>
              {actions && (
                <div className="ml-auto flex items-center gap-2">{actions}</div>
              )}
            </div>
          </div>
        </div>
        {subHeader && <div className="mt-3 ml-8">{subHeader}</div>}
        {(disabled || open) && (
          <div id={`${fullKey}-body`} className="mt-4 ml-8">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
