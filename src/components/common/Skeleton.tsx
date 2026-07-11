"use client";

import { cn } from "@/lib/cn";

/**
 * Skeleton primitives per PPM design system section 5.5.
 *
 * Uses the shimmer gradient declared in globals.css under `.skeleton`.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function KpiCardSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-border p-5 shadow-card",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-24 mt-3" />
      <Skeleton className="h-3 w-32 mt-2" />
    </div>
  );
}

interface TableSkeletonProps extends SkeletonProps {
  rows?: number;
}

export function TableSkeleton({ rows = 5, className }: TableSkeletonProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-border shadow-card overflow-hidden",
        className
      )}
    >
      <div className="border-b border-border bg-surface-muted px-3 py-2.5">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-border p-5 shadow-card",
        className
      )}
    >
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-64 w-full mt-4 rounded" />
    </div>
  );
}
