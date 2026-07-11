"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * KpiCard per PPM design system section 5.2.
 *
 * Use in a grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.
 * Always exactly four (or two on tablet, one on mobile) per row.
 */

type KpiColor = "brand" | "green" | "yellow" | "red";
type KpiTrend = "up" | "down" | "flat";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: KpiTrend;
  trendValue?: string;
  icon?: React.ReactNode;
  color?: KpiColor;
  onClick?: () => void;
  className?: string;
}

const ICON_BOX_CLASSES: Record<KpiColor, string> = {
  brand: "bg-brand-50 text-brand-600",
  green: "bg-status-green-bg text-status-green",
  yellow: "bg-status-yellow-bg text-status-yellow",
  red: "bg-status-red-bg text-status-red",
};

const TREND_CLASSES: Record<KpiTrend, string> = {
  up: "text-status-green",
  down: "text-status-red",
  flat: "text-text-secondary",
};

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  color = "brand",
  onClick,
  className,
}: KpiCardProps) {
  const interactive = typeof onClick === "function";
  const valueString = String(value);
  const isLongValue = valueString.length > 10;

  const Wrapper: React.ElementType = interactive ? "button" : "div";
  const wrapperProps: Record<string, unknown> = interactive
    ? { type: "button", onClick }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "bg-white rounded-lg border border-border p-5 shadow-card transition-all text-left w-full",
        interactive && "hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-label uppercase text-text-secondary leading-tight">
          {title}
        </span>
        {icon && (
          <span
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              ICON_BOX_CLASSES[color]
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className={cn(
          "font-display text-text-primary mt-3",
          isLongValue ? "text-heading-lg" : "text-display-md"
        )}
      >
        {value}
      </div>
      {(subtitle || (trend && trendValue)) && (
        <div className="flex items-center justify-between gap-2 mt-2">
          {subtitle && (
            <span className="text-body-sm text-text-tertiary truncate">
              {subtitle}
            </span>
          )}
          {trend && trendValue && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-body-sm font-medium tabular-nums",
                TREND_CLASSES[trend]
              )}
            >
              {trend === "up" && <TrendingUp size={14} />}
              {trend === "down" && <TrendingDown size={14} />}
              {trend === "flat" && <Minus size={14} />}
              {trendValue}
            </span>
          )}
        </div>
      )}
    </Wrapper>
  );
}
