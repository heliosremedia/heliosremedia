"use client";

import { useLayoutEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

// A router refresh updates server-rendered readiness without resetting client
// form state. Restore the viewport after the refresh commit, not on a timer.
export function useProjectRefreshInPlace() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const position = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!pending && position.current) {
      const saved = position.current;
      position.current = null;
      window.scrollTo({ left: saved.x, top: saved.y, behavior: "instant" });
    }
  }, [pending]);
  useLayoutEffect(() => {
    // Never undo intentional navigation while the server response is arriving.
    const cancel = () => { position.current = null; };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("pointerdown", cancel);
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, []);
  return () => {
    position.current = { x: window.scrollX, y: window.scrollY };
    startTransition(() => router.refresh());
  };
}
