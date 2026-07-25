import "server-only";

import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site";
import type { NewsletterSourceReference } from "@/lib/newsletters/ai";

function excerpt(value: string | null | undefined, max = 4_000) {
  return (value ?? "").trim().slice(0, max);
}

export async function collectVerifiedNewsletterSources(selection: {
  blogPostIds?: string[];
  projectIds?: string[];
  serviceIds?: string[];
  includeWebsiteContent?: boolean;
}): Promise<NewsletterSourceReference[]> {
  const blogPostIds = [...new Set(selection.blogPostIds ?? [])].slice(0, 30);
  const projectIds = [...new Set(selection.projectIds ?? [])].slice(0, 30);
  const serviceIds = [...new Set(selection.serviceIds ?? [])].slice(0, 30);
  const [posts, projects, services, settings] = await Promise.all([
    blogPostIds.length ? prisma.blogPost.findMany({
      where: { id: { in: blogPostIds }, status: "PUBLISHED", publishedAt: { lte: new Date() } },
      select: { id: true, title: true, excerpt: true, content: true, slug: true, sourceLinks: true },
    }) : [],
    projectIds.length ? prisma.project.findMany({
      where: { id: { in: projectIds }, status: "PUBLISHED" },
      select: {
        id: true, title: true, slug: true, shortDescription: true, description: true,
        city: true, state: true, locationLabel: true, projectType: true, propertyType: true,
      },
    }) : [],
    serviceIds.length ? prisma.service.findMany({
      where: { id: { in: serviceIds }, active: true },
      select: { id: true, name: true, slug: true, description: true },
    }) : [],
    selection.includeWebsiteContent ? prisma.siteSettings.findUnique({
      where: { id: "default" },
      select: {
        businessName: true, phoneDisplay: true, email: true, websiteUrl: true,
        serviceArea: true, serviceAreaDescription: true, footerDescription: true,
        standardBody: true, workBody: true, approachBody: true,
      },
    }) : null,
  ]);
  const base = getSiteUrl();
  const sources: NewsletterSourceReference[] = [
    ...posts.map((post) => ({
      id: `blog:${post.id}`, kind: "BLOG_POST", label: post.title,
      excerpt: excerpt([post.excerpt, post.content].filter(Boolean).join("\n\n")),
      url: `${base}/blog/${post.slug}`,
    })),
    ...projects.map((project) => ({
      id: `project:${project.id}`, kind: "PROJECT", label: project.title,
      excerpt: excerpt([
        project.shortDescription, project.description, project.locationLabel,
        [project.city, project.state].filter(Boolean).join(", "), project.projectType, project.propertyType,
      ].filter(Boolean).join("\n")),
      url: `${base}/portfolio/${project.slug}`,
    })),
    ...services.map((service) => ({
      id: `service:${service.id}`, kind: "SERVICE", label: service.name,
      excerpt: excerpt(service.description), url: `${base}/services/${service.slug}`,
    })),
  ];
  if (settings) {
    sources.push({
      id: "website:site-settings", kind: "WEBSITE_CONTENT", label: settings.businessName,
      excerpt: excerpt([
        settings.serviceArea, settings.serviceAreaDescription, settings.footerDescription,
        settings.standardBody, settings.workBody, settings.approachBody,
        settings.phoneDisplay, settings.email,
      ].filter(Boolean).join("\n")),
      url: settings.websiteUrl || base,
    });
  }
  return sources;
}
