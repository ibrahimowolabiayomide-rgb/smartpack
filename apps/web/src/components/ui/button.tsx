import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SpinnerIcon } from '@/components/icons';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';
export type ButtonSize = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap ' +
  'transition-colors select-none aria-disabled:pointer-events-none aria-disabled:opacity-55 ' +
  'disabled:pointer-events-none disabled:opacity-55';

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-accent bg-accent text-accent-ink hover:border-accent-hover hover:bg-accent-hover ' +
    'active:bg-accent-hover',
  secondary: 'border-line-strong bg-surface text-ink hover:bg-sunken active:bg-line',
  quiet: 'border-transparent bg-transparent text-ink hover:bg-sunken active:bg-line',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-meta pointer-coarse:h-11',
  md: 'h-10 px-4 text-ui pointer-coarse:h-11',
};

/** Class names for anything that must look like a button (links, triggers). */
export function buttonStyles(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
): string {
  return cn(base, variants[variant], sizes[size]);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export interface ButtonProps extends ComponentProps<'button'>, CommonProps {
  /** Shows a spinner, announces busy state and blocks further clicks. */
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonStyles(variant, size), className)}
      {...props}
    >
      {loading ? <SpinnerIcon width={16} height={16} className="motion-safe:animate-spin" /> : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps
  extends Omit<ComponentProps<typeof Link>, 'children'>, CommonProps {
  children: ReactNode;
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonStyles(variant, size), className)} {...props}>
      {children}
    </Link>
  );
}
