import type { NextConfig } from "next";

function getR2ImagePattern() {
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!publicUrl) {
    return null;
  }

  try {
    const url = new URL(publicUrl);
    const pathname = url.pathname.replace(/\/$/, "");

    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: `${pathname}/**`,
    };
  } catch {
    return null;
  }
}

const r2ImagePattern = getR2ImagePattern();

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 95],
    remotePatterns: r2ImagePattern ? [r2ImagePattern] : [],
  },
};

export default nextConfig;
