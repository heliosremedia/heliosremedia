export const PORTFOLIO_LIGHTBOX_WIDTHS = [1600, 1920, 2560] as const;

export function selectPortfolioLightboxWidth(
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio = 1,
) {
  const requested = Math.max(viewportWidth, viewportHeight) * Math.max(1, devicePixelRatio);
  return (
    PORTFOLIO_LIGHTBOX_WIDTHS.find((width) => width >= requested) ??
    PORTFOLIO_LIGHTBOX_WIDTHS[PORTFOLIO_LIGHTBOX_WIDTHS.length - 1]
  );
}

export function portfolioImageDerivativeUrl(
  sourceUrl: string,
  width: number,
  quality: 75 | 85 = 85,
) {
  return `/_next/image?url=${encodeURIComponent(sourceUrl)}&w=${width}&q=${quality}`;
}

export function adjacentPortfolioIndexes(activeIndex: number, count: number) {
  if (activeIndex < 0 || count < 2) return [];
  const previous = (activeIndex - 1 + count) % count;
  const next = (activeIndex + 1) % count;
  return previous === next ? [previous] : [previous, next];
}
