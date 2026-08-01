import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import { blogImageUrl, readingMinutes } from "@/lib/blog";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export async function generateMetadata():Promise<Metadata>{const settings=await getSiteSettings();return buildPageMetadata({title:`Insights | ${settings.businessName}`,description:`Ideas, guidance, and perspective from ${settings.businessName}.`,path:"/blog",settings});}
async function getPublishedPosts(){try{return await prisma.blogPost.findMany({where:{OR:[{status:"PUBLISHED",publishedAt:{lte:new Date()}},{status:"SCHEDULED",scheduledAt:{lte:new Date()}}]},orderBy:[{publishedAt:"desc"},{scheduledAt:"desc"},{createdAt:"desc"}],include:{featuredMedia:{select:{storageKey:true}}}});}catch(error){if(process.env.NODE_ENV!=="production")console.warn("Blog posts unavailable; showing the empty journal state.",error);return[];}}

export default async function BlogPage(){
  const [settings,posts]=await Promise.all([getSiteSettings(),getPublishedPosts()]);
  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <Navbar variant="solid" />
      <section className="relative overflow-hidden border-b border-white/[0.08] pt-24 sm:pt-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_14%,rgba(217,107,43,0.16),transparent_36%)]" />
        <div className="container-shell relative pb-24 pt-16 sm:pb-32 sm:pt-24">
          <p className="eyebrow text-[var(--helios-orange)]">The journal</p>
          <h1 className="mt-7 max-w-5xl font-display text-[clamp(3.8rem,8vw,7.5rem)] font-light leading-[0.98] tracking-[-0.055em]">
            Ideas that shape how property is seen.
          </h1>
          <p className="mobile-summary mt-16 max-w-3xl text-base leading-8 text-white/50 sm:mt-20">
            Editorial perspective, marketing guidance, and stories from{" "}
            {settings.businessName}.
          </p>
        </div>
      </section>
      <section className="container-shell section-space">
        <div className="grid gap-x-7 gap-y-14 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => {
            const image = blogImageUrl(post);
            return (
              <article key={post.id} className="group">
                <Link href={`/blog/${post.slug}`} className="block">
                  {image ? (
                    <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.03]">
                      <Image
                        src={image}
                        alt={post.featuredImageAlt || post.title}
                        fill
                        className="object-cover transition duration-700 group-hover:scale-[1.025]"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-gradient-to-br from-white/[0.06] to-[var(--helios-orange)]/[0.08]" />
                  )}
                  <p className="mt-6 text-[0.56rem] uppercase tracking-[0.18em] text-[var(--helios-orange)]">
                    {post.category || "Insights"} · {readingMinutes(post.content)}{" "}
                    min read
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-light leading-tight text-white/90 transition group-hover:text-white">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mobile-summary mt-3 text-sm leading-7 text-white/40">
                      {post.excerpt}
                    </p>
                  )}
                </Link>
              </article>
            );
          })}
          {!posts.length && (
            <div className="col-span-full border-y border-white/10 py-24 text-center">
              <p className="font-display text-4xl text-white/40">
                The first story is being crafted.
              </p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
