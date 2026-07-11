"use client";

import { cn } from "@/lib/cn";

/**
 * StatusBadge per PPM design system section 5.3.
 *
 * Status text is matched case-insensitively against a keyword map. Unknown
 * status strings render with the neutral fallback so the badge still renders
 * something readable instead of an empty box.
 */

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
}

const STATUS_CLASSES: Array<{ match: RegExp; classes: string }> = [
  {
    match: /^(green|in progress|completed|active|approved|posted|funded|success|ok|on track)$/i,
    classes: "bg-status-green-bg text-status-green",
  },
  {
    match: /^(yellow|at risk|on hold|medium|pending|warning|degraded)$/i,
    classes: "bg-status-yellow-bg text-status-yellow",
  },
  {
    match: /^(red|critical|cancelled|canceled|rejected|failed|error|blocked)$/i,
    classes: "bg-status-red-bg text-status-red",
  },
  {
    match: /^(blue|planning|submitted|low|locked|info|new)$/i,
    classes: "bg-status-blue-bg text-status-blue",
  },
  {
    match: /^high$/i,
    classes: "bg-orange-50 text-orange-600",
  },
  {
    match: /^(pending approval|deferred)$/i,
    classes: "bg-amber-50 text-amber-700",
  },
  {
    match: /^(draft|inactive|closed)$/i,
    classes: "bg-gray-100 text-gray-500",
  },
  {
    match: /^(archived|superseded)$/i,
    classes: "bg-gray-100 text-gray-400",
  },
];

const FALLBACK_CLASSES = "bg-surface-muted text-text-secondary";

function classesFor(status: string): string {
  const trimmed = status.trim();
  for (const entry of STATUS_CLASSES) {
    if (entry.match.test(trimmed)) return entry.classes;
  }
  return FALLBACK_CLASSES;
}

export function StatusBadge({ status, size = "md", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-body-sm",
        classesFor(status),
        className
      )}
    >
      {status}
    </span>
  );
}
