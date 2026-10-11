"use client";

import { useEffect, useState } from "react";

type LocalDateTimeProps = {
  value: string;
  className?: string;
  inline?: boolean;
};

function formatUtc(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatLocal(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

/** Keep server output deterministic, then present the same instant in the viewer's zone. */
export default function LocalDateTime({ value, className, inline = false }: LocalDateTimeProps) {
  const [label, setLabel] = useState(() => formatUtc(value));

  useEffect(() => {
    setLabel(formatLocal(value));
  }, [value]);

  if (inline) return <span className={className}>{label}</span>;
  return <time dateTime={value} className={className} suppressHydrationWarning>{label}</time>;
}
