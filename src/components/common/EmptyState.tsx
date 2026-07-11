"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * EmptyState per PPM design system section 5.5.
 *
 * Variants:
 *  - card: default white card with border (use inside a page section).
 *  - inline: no chrome, just centered content (use inside an existing card).
 *  - dashed: dashed-border ghost frame (use for "add your first X" prompts).
 */

type EmptyStateVariant = "card" | "inline" | "dashed";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  variant?: EmptyStateVariant;
  compact?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<EmptyStateVariant, string> = {
  card: "bg-white rounded-xl border border-border",
  inline: "",
  dashed: "rounded-lg border border-dashed border-border",
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "card",
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-6 px-4" : "py-12 px-6",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {icon && (
        <span className="text-text-tertiary mb-3 inline-flex">{icon}</span>
      )}
      <h3 className="font-display text-heading-sm text-text-primary mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-body-sm text-text-secondary max-w-md">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
