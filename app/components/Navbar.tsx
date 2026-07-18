"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSiteSettings } from "./SiteSettingsProvider";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Services", href: "/services" },
  { label: "About Helios", href: "/about" },
  { label: "FAQs", href: "/faq" },
];

const ease = [0.22, 1, 0.36, 1] as const;

type NavbarProps = {
  variant?: "overlay" | "solid";
};

export default function Navbar({ variant = "overlay" }: NavbarProps) {
  const settings = useSiteSettings();
  const pathname = usePathname();
  const bookingHref = settings.bookingUrl || "/inquire";
  const [menuOpen, setMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);

    window.addEventListener("resize", closeMenu);

    return () => {
      window.removeEventListener("resize", closeMenu);
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header
        className={
          variant === "solid"
            ? "relative z-50 border-b border-white/[0.08] bg-[#090909]/95 backdrop-blur-xl"
            : "absolute inset-x-0 top-0 z-50"
        }
      >
        <div
          className={`mx-auto flex w-full max-w-[1600px] items-center justify-between px-5 sm:px-8 md:px-10 lg:px-12 xl:px-14 ${
            variant === "solid"
              ? "py-5"
              : "pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] md:py-8"
          }`}
        >
          <motion.div
            className="relative z-50 shrink-0"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.85,
              delay: shouldReduceMotion ? 0 : 1.15,
              ease,
            }}
          >
            <Link
              href="/"
              aria-label="Helios Real Estate Media home"
              onClick={closeMenu}
            >
              <Image
                src="/brand/helios-logo.png"
                alt="Helios Real Estate Media"
                width={260}
                height={90}
                priority
                className="h-auto w-36 sm:w-40 md:w-48 lg:w-[13rem]"
              />
            </Link>
          </motion.div>

          <motion.nav
            aria-label="Primary navigation"
            className="hidden items-center gap-8 md:flex lg:gap-10 xl:gap-12"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.8,
              delay: shouldReduceMotion ? 0 : 0.35,
              ease,
            }}
          >
            {navigation.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative py-3 text-[11px] font-semibold uppercase tracking-[0.25em] transition-colors duration-[400ms] hover:text-[var(--helios-orange)] ${
                    active ? "text-[var(--helios-orange)]" : "text-white"
                  }`}
                >
                  {item.label}

                  <span
                    className={`absolute bottom-1 left-0 h-px bg-[var(--helios-orange)] transition-all duration-[400ms] group-hover:w-full ${
                      active ? "w-full" : "w-0"
                    }`}
                  />
                </Link>
              );
            })}

            <motion.a
              href={bookingHref}
              className="flex min-h-14 items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-8 text-[11px] font-semibold uppercase tracking-[0.23em] text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] lg:px-9"
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : {
                      y: -3,
                      scale: 1.015,
                      backgroundColor: "var(--helios-orange-hover)",
                      boxShadow: "0 18px 46px rgba(217,107,43,0.42)",
                    }
              }
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 24,
              }}
            >
              Book Now
            </motion.a>
          </motion.nav>

          <motion.button
            type="button"
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            className="relative z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/10 backdrop-blur-md md:hidden"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.8,
              delay: shouldReduceMotion ? 0 : 0.35,
              ease,
            }}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span className="relative block h-4 w-5">
              <motion.span
                className="absolute left-0 top-[3px] h-px w-5 bg-white"
                animate={menuOpen ? { y: 5, rotate: 45 } : { y: 0, rotate: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.4,
                  ease,
                }}
              />

              <motion.span
                className="absolute bottom-[3px] right-0 h-px w-4 bg-white"
                animate={
                  menuOpen
                    ? { y: -5, rotate: -45, width: 20 }
                    : { y: 0, rotate: 0, width: 16 }
                }
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.4,
                  ease,
                }}
              />
            </span>
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-navigation"
            className="fixed inset-0 z-40 overflow-hidden bg-[var(--background)] md:hidden"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.45,
              ease,
            }}
          >
            <motion.div
              className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(217,107,43,0.17),transparent_34%)]"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.8,
              }}
            />

            <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-soft-light" />

            <div className="container-shell relative flex min-h-svh flex-col pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(8.75rem+env(safe-area-inset-top))]">
              <nav
                aria-label="Mobile primary navigation"
                className="flex flex-1 flex-col justify-center"
              >
                <div className="mb-8 flex items-center gap-4">
                  <motion.span
                    className="h-px bg-[var(--helios-orange)]"
                    initial={
                      shouldReduceMotion ? false : { width: 0, opacity: 0 }
                    }
                    animate={{ width: 48, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.65,
                      delay: shouldReduceMotion ? 0 : 0.15,
                      ease,
                    }}
                  />

                  <motion.span
                    className="eyebrow text-white/50"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.55,
                      delay: shouldReduceMotion ? 0 : 0.22,
                      ease,
                    }}
                  >
                    Navigate
                  </motion.span>
                </div>

                <div className="flex flex-col">
                  {navigation.map((item, index) => (
                    <motion.div
                      key={item.label}
                      className="border-b border-[var(--helios-border)]"
                      initial={
                        shouldReduceMotion
                          ? false
                          : {
                              opacity: 0,
                              y: 30,
                              filter: "blur(8px)",
                            }
                      }
                      animate={{
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                      }}
                      exit={{
                        opacity: 0,
                        y: 16,
                        filter: "blur(5px)",
                      }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.65,
                        delay: shouldReduceMotion ? 0 : 0.22 + index * 0.07,
                        ease,
                      }}
                    >
                      <Link
                        href={item.href}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        className={`group flex items-end justify-between gap-6 py-5 font-display text-[clamp(2.9rem,13vw,4.5rem)] font-light leading-none tracking-[-0.04em] ${
                          isActive(item.href)
                            ? "text-[var(--helios-orange)]"
                            : "text-[var(--foreground)]"
                        }`}
                        onClick={closeMenu}
                      >
                        <span>{item.label}</span>

                        <span className="mb-1 text-base font-light text-[var(--helios-orange)] transition-transform duration-500 group-hover:translate-x-1">
                          ↗
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </div>

                <motion.a
                  href={bookingHref}
                  className="mt-10 flex min-h-14 w-full items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-8 text-xs font-semibold uppercase tracking-[0.23em] text-white"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.65,
                    delay: shouldReduceMotion ? 0 : 0.48,
                    ease,
                  }}
                  onClick={closeMenu}
                >
                  Book Your Shoot
                </motion.a>
              </nav>

              <motion.div
                className="flex items-end justify-between gap-6 pt-10"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.55,
                  delay: shouldReduceMotion ? 0 : 0.58,
                  ease,
                }}
              >
                <p className="max-w-[14rem] text-xs leading-5 text-white/45">
                  Luxury real estate media crafted in {settings.serviceArea}.
                </p>

                <span className="eyebrow text-[var(--helios-orange)]">
                  Helios
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
