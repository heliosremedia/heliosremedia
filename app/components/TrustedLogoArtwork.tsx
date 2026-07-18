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
          WebkitMaskImage: `url("${src}")`,
          maskImage: `url("${src}")`,
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
      src={src}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      className={`h-full w-full object-contain ${className}`}
      style={{ opacity, transform }}
    />
  );
}
