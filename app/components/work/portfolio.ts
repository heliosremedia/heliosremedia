export type PortfolioItem = {
  title: string;
  href: string;
  image: string;
  size: "hero" | "supporting";
};

export const portfolioItems: PortfolioItem[] = [
  {
    title: "Cinematic Films",
    href: "/portfolio/cinematic-films",
    image: "/work/cards/cinematicfilms-workcard.jpg",
    size: "hero",
  },
  {
    title: "Photography",
    href: "/portfolio/photography",
    image: "/work/cards/photography-workcard.jpg",
    size: "supporting",
  },
  {
    title: "Agent Branding",
    href: "/portfolio/agent-branding",
    image: "/work/cards/agent-branding-workcard.jpg",
    size: "supporting",
  },
  {
    title: "Aerial & Drone",
    href: "/portfolio/aerial-drone",
    image: "/work/cards/aerial-drone-workcard.jpg",
    size: "supporting",
  },
  {
    title: "Social Media",
    href: "/portfolio/social-media",
    image: "/work/cards/socialmedia-workcard.jpg",
    size: "supporting",
  },
];