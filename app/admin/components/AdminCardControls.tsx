"use client";

import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> & {
  label: string;
  symbol: "+" | "−" | "↑" | "↓";
};

export function AdminCardIconButton({
  label,
  symbol,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={label}
      data-tooltip={label}
      className={`admin-btn-icon text-xl font-light leading-none ${className}`}
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

export function AdminCardToggle({
  expanded,
  label,
  controls,
  ...props
}: Omit<IconButtonProps, "label" | "symbol" | "aria-expanded" | "aria-controls"> & {
  expanded: boolean;
  label: string;
  controls?: string;
}) {
  return (
    <AdminCardIconButton
      {...props}
      label={`${expanded ? "Collapse" : "Expand"} ${label}`}
      symbol={expanded ? "−" : "+"}
      aria-expanded={expanded}
      aria-controls={controls}
    />
  );
}

export function AdminDragHandle({
  label,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { label: string }) {
  return (
    <span
      aria-hidden="true"
      title={`Drag ${label} to reorder`}
      className={`admin-btn-icon cursor-grab select-none text-lg active:cursor-grabbing ${className}`}
      {...props}
    >
      <span aria-hidden="true">⠿</span>
    </span>
  );
}
