export type PortfolioItem = {
  title: string;
  href: string;
  image: string;
  size: "hero" | "supporting";
  imageAlt?: string;
  videoSrc?: string | null;
  embedSrc?: string | null;
};

export const portfolioItems: PortfolioItem[] = [
  {
    title: "Cinematic Films",
    href: "/portfolio?service=cinematic-films",
    image: "/work/cards/cinematicfilms-workcard.jpg",
    size: "hero",
  },
  {
    title: "Photography",
    href: "/portfolio?service=photography",
    image: "/work/cards/photography-workcard.jpg",
    size: "supporting",
  },
  {
    title: "Agent Branding",
    href: "/portfolio?service=agent-branding",
    image: "/work/cards/agent-branding-workcard.jpg",
    size: "supporting",
  },
  {
    title: "Aerial & Drone",
    href: "/portfolio?service=drone-photography",
    image: "/work/cards/aerial-drone-workcard.jpg",
    size: "supporting",
  },
  {
    title: "Social Media",
    href: "/portfolio?service=social-content",
    image: "/work/cards/socialmedia-workcard.jpg",
    size: "supporting",
  },
];
