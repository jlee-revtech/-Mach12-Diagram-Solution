"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Button primitive per PPM design system section 5.1.
 *
 * Always pass an icon via the `icon` prop (or `trailingIcon`) instead of
 * inlining an svg before {children}, so the sizing scale below stays correct.
 * For icon-only buttons, pass `iconOnly` and provide `aria-label`.
 */

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium rounded-lg transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-500 !text-white hover:bg-brand-600 disabled:bg-slate-300 disabled:!text-white/80",
        secondary:
          "bg-white border border-border text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-50",
        ghost:
          "text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-40",
        destructive:
          "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 disabled:opacity-50",
        ai: "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 disabled:opacity-60",
      },
      size: {
        sm: "h-8 px-2.5 text-[12px] gap-1",
        md: "h-9 px-3 text-body-sm gap-1.5",
        lg: "h-10 px-4 text-body-md gap-2",
      },
      iconOnly: {
        true: "px-0",
        false: "",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      { size: "sm", iconOnly: true, class: "w-8" },
      { size: "md", iconOnly: true, class: "w-9" },
      { size: "lg", iconOnly: true, class: "w-10" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      iconOnly: false,
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "iconOnly" | "fullWidth"> {
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  iconOnly?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      icon,
      trailingIcon,
      iconOnly,
      fullWidth,
      loading,
      disabled,
      children,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          buttonVariants({ variant, size, iconOnly, fullWidth }),
          className
        )}
        {...props}
      >
        {loading ? (
          <Spinner size={size ?? "md"} />
        ) : (
          icon && <span className="inline-flex shrink-0">{icon}</span>
        )}
        {!iconOnly && children}
        {!loading && trailingIcon && (
          <span className="inline-flex shrink-0">{trailingIcon}</span>
        )}
      </button>
    );
  }
);

function Spinner({ size }: { size: "sm" | "md" | "lg" }) {
  const px = size === "sm" ? 12 : size === "lg" ? 16 : 14;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { buttonVariants };
