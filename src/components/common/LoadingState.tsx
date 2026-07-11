"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * LoadingState per PPM design system section 5.5. Mirrors EmptyState layout
 * so swapping between them does not shift the page.
 */

type LoadingVariant = "card" | "inline" | "dashed";

interface LoadingStateProps {
  label?: string;
  variant?: LoadingVariant;
  compact?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<LoadingVariant, string> = {
  card: "bg-white rounded-xl border border-border",
  inline: "",
  dashed: "rounded-lg border border-dashed border-border",
};

export function LoadingState({
  label = "Loading...",
  variant = "card",
  compact = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-6 px-4" : "py-12 px-6",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      <Loader2
        className={cn(
          "animate-spin text-text-tertiary mb-3",
          compact ? "size-4" : "size-6"
        )}
      />
      <span className="text-body-sm text-text-tertiary">{label}</span>
    </div>
  );
}
