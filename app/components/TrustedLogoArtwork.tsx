type TrustedLogoArtworkProps = {
  src: string;
  alt: string;
  monochrome: boolean;
  color: string;
  opacity: number;
  scale: number;
  decorative?: boolean;
  className?: string;
};

function getDisplaySource(src: string) {
  try {
    const url = new URL(src, "https://helios.local");
    const match = url.pathname.match(/^\/trusted-logos\/([^/]+)$/);

    if (match) {
      return `/trusted-logo-assets/${encodeURIComponent(match[1])}`;
    }
  } catch {
    // Preserve malformed or browser-local preview URLs so the image can
    // surface its normal loading failure without breaking the component.
  }

  return src;
}

export default function TrustedLogoArtwork({
  src,
  alt,
  monochrome,
  color,
  opacity,
  scale,
  decorative = false,
  className = "",
}: TrustedLogoArtworkProps) {
  const transform = `scale(${scale})`;
  const displaySource = getDisplaySource(src);

  if (monochrome) {
    return (
      <span
        role={decorative ? undefined : "img"}
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : alt}
        className={`block h-full w-full ${className}`}
        style={{
          backgroundColor: color,
          opacity,
          transform,
          WebkitMaskImage: `url("${displaySource}")`,
          maskImage: `url("${displaySource}")`,
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySource}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      className={`h-full w-full object-contain ${className}`}
      style={{ opacity, transform }}
    />
  );
}
