"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * DrillDrawer per PPM design system section 6.3.
 *
 * Right-side detail drawer for in-context drill-through (clicking a row in a
 * list opens the detail without leaving the page). Closes on Escape or
 * backdrop click.
 */

type DrillWidth = "sm" | "md" | "lg";

interface DrillDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  width?: DrillWidth;
  headerActions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

const WIDTH_CLASSES: Record<DrillWidth, string> = {
  sm: "w-96",
  md: "w-[480px]",
  lg: "w-[640px]",
};

export function DrillDrawer({
  open,
  onClose,
  title,
  width = "md",
  headerActions,
  footer,
  children,
}: DrillDrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className={cn(
          "bg-white border-l border-border shadow-modal h-full flex flex-col animate-slide-in-right",
          WIDTH_CLASSES[width]
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="sticky top-0 bg-white border-b border-border px-4 py-3 flex items-center gap-2 shrink-0">
          <h2 className="text-heading-sm font-display text-text-primary flex-1 truncate">
            {title}
          </h2>
          {headerActions && (
            <div className="flex items-center gap-1">{headerActions}</div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded inline-flex items-center justify-center text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
        {footer && (
          <footer className="border-t border-border px-4 py-3 shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
