export type LocationPage = {
  slug: string;
  city: string;
  county: string;
  seoTitle: string;
  seoDescription: string;
  heroLead: string;
  introduction: string;
  marketTitle: string;
  marketCopy: string;
  localDetails: string[];
  serviceArea: string;
};

export const LOCATION_PAGES: LocationPage[] = [
  {
    slug: "fort-collins",
    city: "Fort Collins",
    county: "Larimer County",
    seoTitle:
      "Fort Collins Real Estate Photography & Video | Helios",
    seoDescription:
      "Premium real estate photography, cinematic video, drone media, vertical reels, and listing content for Fort Collins agents and properties.",
    heroLead:
      "Intentional real estate photography and cinematic media for listings across Fort Collins.",
    introduction:
      "Fort Collins listings compete on more than square footage. Buyers are responding to lifestyle, setting, and the feeling of a home—from historic character near Old Town to modern design along the city’s growing edges. Helios builds each visual story to make that distinction clear.",
    marketTitle: "Fort Collins deserves more than a standard photo set.",
    marketCopy:
      "A craftsman near City Park, a foothills-view acreage, and a contemporary southeast Fort Collins home should never be marketed the same way. We shape the photography, motion, aerial perspective, and social assets around what makes each property matter—then deliver a polished collection agents can use everywhere.",
    localDetails: [
      "Old Town and central Fort Collins character homes",
      "Southeast Fort Collins and Harmony corridor listings",
      "Foothills, reservoir, and acreage properties",
      "Agent branding and community-focused content",
    ],
    serviceArea:
      "Serving Fort Collins, Laporte, Bellvue, and nearby Northern Colorado communities.",
  },
  {
    slug: "loveland",
    city: "Loveland",
    county: "Larimer County",
    seoTitle: "Loveland Real Estate Photography & Video | Helios",
    seoDescription:
      "Luxury real estate photography, cinematic films, drone coverage, and social media content for Loveland, Colorado listings and agents.",
    heroLead:
      "Elevated listing media for Loveland homes, communities, and the agents who represent them.",
    introduction:
      "Loveland brings together established neighborhoods, fast-moving new construction, lake communities, acreage, and unmistakable foothills access. Our job is to translate those advantages into a visual experience that buyers understand immediately.",
    marketTitle: "Show the property—and the Loveland lifestyle around it.",
    marketCopy:
      "The strongest Loveland marketing reveals more than rooms. It can establish proximity to the foothills, capture water and open-space relationships, communicate a thoughtful remodel, or give a new-build listing the warmth it needs to stand apart. Helios plans each shoot around that larger story.",
    localDetails: [
      "Downtown Loveland and established central neighborhoods",
      "West Loveland foothills and acreage properties",
      "Centerra, Lakes at Centerra, and new construction",
      "Lake, golf, and lifestyle-driven community media",
    ],
    serviceArea:
      "Serving Loveland, Berthoud, Campion, Masonville, and surrounding communities.",
  },
  {
    slug: "windsor",
    city: "Windsor",
    county: "Weld and Larimer Counties",
    seoTitle: "Windsor Real Estate Photography & Video | Helios",
    seoDescription:
      "Professional property photography, cinematic video, drone media, and vertical reels for real estate listings throughout Windsor, Colorado.",
    heroLead:
      "Refined real estate media for Windsor’s homes, neighborhoods, and destination communities.",
    introduction:
      "Windsor buyers are often choosing between a home, a neighborhood, and an entire way of living. Strong listing media must communicate all three. Helios combines architectural precision with cinematic storytelling so the property feels connected to the community around it.",
    marketTitle: "Turn Windsor’s community value into a visual advantage.",
    marketCopy:
      "From Water Valley and RainDance to custom homes, golf communities, and growing east-side neighborhoods, Windsor listings benefit from context. We use photography, aerial media, film, and social-first content to show scale, amenities, setting, and the details buyers remember.",
    localDetails: [
      "Water Valley, RainDance, and golf-community listings",
      "New construction and builder inventory",
      "Custom homes and luxury properties",
      "Community amenities, trails, and aerial context",
    ],
    serviceArea:
      "Serving Windsor, Severance, Timnath, and nearby Northern Colorado communities.",
  },
  {
    slug: "greeley",
    city: "Greeley",
    county: "Weld County",
    seoTitle: "Greeley Real Estate Photography & Video | Helios",
    seoDescription:
      "Professional real estate photography, aerial media, cinematic video, and listing marketing for agents and properties in Greeley, Colorado.",
    heroLead:
      "Clear, polished property storytelling for Greeley listings at every scale.",
    introduction:
      "Greeley’s market spans first-time-buyer homes, established neighborhoods, new construction, investment properties, luxury residences, and nearby acreage. Helios gives each listing the level of intention it needs to compete—without forcing every property into the same visual formula.",
    marketTitle: "Every Greeley listing should feel deliberately presented.",
    marketCopy:
      "Professional media builds confidence before a showing ever begins. We photograph spaces honestly and beautifully, use aerial coverage when location or land matters, and create film and social assets that help agents carry the listing story beyond the MLS.",
    localDetails: [
      "Established central and west Greeley neighborhoods",
      "New construction and growing residential communities",
      "Acreage, equestrian, and rural-edge properties",
      "Investor, rental, and commercial media needs",
    ],
    serviceArea:
      "Serving Greeley, Evans, Garden City, Eaton, and surrounding Weld County communities.",
  },
  {
    slug: "timnath",
    city: "Timnath",
    county: "Larimer County",
    seoTitle: "Timnath Real Estate Photography & Video | Helios",
    seoDescription:
      "Premium real estate photography, cinematic films, drone media, and social content for Timnath, Colorado homes, agents, and builders.",
    heroLead:
      "Modern listing media designed for Timnath’s homes, builders, and fast-growing communities.",
    introduction:
      "Timnath is defined by new communities, thoughtful amenities, open views, and a growing collection of highly designed homes. The visual presentation should feel as current and considered as the property itself.",
    marketTitle: "Modern homes need modern storytelling.",
    marketCopy:
      "Helios creates crisp architectural photography, cinematic movement, aerial context, and vertical content that helps Timnath listings stand apart from similar inventory. For builders and agents, that same system creates a consistent visual standard across multiple homes and campaigns.",
    localDetails: [
      "Timnath Ranch and amenity-rich communities",
      "Luxury and custom residential properties",
      "Builder inventory and model-home content",
      "Reservoir, open-space, and Front Range perspectives",
    ],
    serviceArea:
      "Serving Timnath, Fort Collins, Windsor, and nearby Larimer County communities.",
  },
  {
    slug: "severance",
    city: "Severance",
    county: "Weld County",
    seoTitle: "Severance Real Estate Photography & Video | Helios",
    seoDescription:
      "Real estate photography, drone media, cinematic video, and social content for Severance, Colorado listings and real estate professionals.",
    heroLead:
      "Property media that gives Severance listings space, context, and a stronger sense of place.",
    introduction:
      "Severance continues to attract buyers looking for newer homes, more room, community amenities, and access to the wider Northern Colorado region. Great media should make those advantages visible before buyers ever arrive.",
    marketTitle: "Give buyers the full picture of life in Severance.",
    marketCopy:
      "We combine clean interior and exterior photography with aerial views, cinematic film, and short-form content to show how the home, lot, neighborhood, and surrounding landscape work together. The result is a listing presentation that feels complete—not generic.",
    localDetails: [
      "Newer residential communities and builder listings",
      "Large-lot and semi-rural properties",
      "Mountain-view and open-space positioning",
      "Agent-led neighborhood and community content",
    ],
    serviceArea:
      "Serving Severance, Windsor, Eaton, Greeley, and surrounding Weld County communities.",
  },
];

export function getLocationPage(slug: string) {
  return LOCATION_PAGES.find((location) => location.slug === slug);
}

