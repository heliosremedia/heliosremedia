import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type AdminButtonVariant = "primary" | "secondary" | "destructive" | "ghost" | "subtle" | "link" | "linkDestructive";
type AdminButtonSize = "default" | "sm" | "lg";

const variantClasses: Record<AdminButtonVariant, string> = {
  primary: "admin-btn-primary",
  secondary: "admin-btn-secondary",
  destructive: "admin-btn-destructive",
  ghost: "admin-btn-ghost",
  subtle: "admin-btn-subtle",
  link: "admin-btn-link",
  linkDestructive: "admin-btn-link-destructive",
};

const sizeClasses: Record<AdminButtonSize, string> = {
  default: "",
  sm: "min-h-10 px-4 py-2 text-[0.54rem]",
  lg: "min-h-12 px-7 py-3 text-[0.62rem]",
};

function classes(variant: AdminButtonVariant, size: AdminButtonSize, className?: string) {
  return [variantClasses[variant], sizeClasses[size], className].filter(Boolean).join(" ");
}

type BaseProps = {
  children: ReactNode;
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  className?: string;
  isLoading?: boolean;
};

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };
type LinkProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function AdminButton({ children, variant = "primary", size = "default", className, isLoading, disabled, ...props }: ButtonProps) {
  return <button className={classes(variant, size, className)} disabled={disabled || isLoading} aria-busy={isLoading || undefined} {...props}>{isLoading ? <span className="admin-btn-loading-dot" aria-hidden="true" /> : null}{children}</button>;
}

export function AdminButtonLink({ children, variant = "secondary", size = "default", className, href, ...props }: LinkProps) {
  return <Link href={href} className={classes(variant, size, className)} {...props}>{children}</Link>;
}

export function AdminIconButton({ className, children, disabled, isLoading, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean }) {
  return <button className={["admin-btn-icon", className].filter(Boolean).join(" ")} disabled={disabled || isLoading} aria-busy={isLoading || undefined} {...props}>{isLoading ? <span className="admin-btn-loading-dot" aria-hidden="true" /> : children}</button>;
}
