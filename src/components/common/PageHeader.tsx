"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * PageHeader per PPM design system section 5.4.
 *
 * Layout: optional breadcrumb row, then a flex row with icon (24px) + title
 * + adornments + (right-aligned) helpKey + actions, then optional subtitle.
 * The `helpKey` opens a HowThisWorks popover when that subsystem is wired
 * up; until then it is reserved as a stable API surface.
 */

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  breadcrumb?: ReactNode;
  titleAdornments?: ReactNode;
  helpKey?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  breadcrumb,
  titleAdornments,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("", className)}>
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex items-center gap-3 flex-wrap">
        {icon && (
          <span className="text-brand-600 shrink-0 inline-flex">{icon}</span>
        )}
        <h1 className="text-heading-lg font-display text-text-primary truncate">
          {title}
        </h1>
        {titleAdornments && (
          <div className="flex items-center gap-2">{titleAdornments}</div>
        )}
        {actions && (
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        )}
      </div>
      {subtitle && (
        <p className="text-body-sm text-text-secondary mt-1">{subtitle}</p>
      )}
    </header>
  );
}
