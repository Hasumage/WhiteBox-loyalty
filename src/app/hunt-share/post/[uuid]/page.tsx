import Link from "next/link";
import { Heart, MapPin, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicHuntSharePost } from "@/lib/api/twa-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ uuid: string }>;
};

const interactiveClass = "cursor-pointer transition hover:border-cyan-200/35 hover:bg-cyan-200/10 hover:text-cyan-50 active:scale-[0.98]";

function mediaSrc(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("/api/")) return `/backend-api/${url.slice(5)}`;
  if (url.startsWith("/hunt/posts/")) return url.replace("/hunt/posts/", "/hunt-assets/posts/");
  if (url.startsWith("/hunt/cards/")) return url.replace("/hunt/cards/", "/hunt-assets/cards/");
  if (url.startsWith("/hunt/shop/")) return url.replace("/hunt/shop/", "/hunt-assets/shop/");
  return url;
}

export default async function HuntPostSharePage({ params }: PageProps) {
  const { uuid } = await params;
  const payload = await getPublicHuntSharePost(uuid);
  const post = payload?.post;
  const image = mediaSrc(post?.photoUrl ?? post?.mediaUrls[0]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <section className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/hunt" className={`text-sm font-semibold text-cyan-100 ${interactiveClass}`}>Nearloy Hunt</Link>
          <Badge className="border-cyan-200/20 bg-cyan-200/10 text-cyan-100">NH Post</Badge>
        </div>
        {!post ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-cyan-100" />
            <h1 className="mt-4 text-2xl font-semibold">Post is unavailable</h1>
            <p className="mt-2 text-sm text-white/58">It may be hidden, removed or still waiting for moderation.</p>
          </div>
        ) : (
          <article className="overflow-hidden rounded-[28px] border border-cyan-200/18 bg-[linear-gradient(135deg,rgba(8,13,22,0.96),rgba(15,23,42,0.78))] shadow-[0_0_42px_rgba(103,232,249,0.12)]">
            {image && <img src={image} alt="" className="h-64 w-full object-cover" />}
            <div className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">{post.place.name}</h1>
                  <p className="mt-1 flex items-center gap-1 text-sm text-white/52">
                    <MapPin className="h-4 w-4 text-cyan-100" />
                    {[post.place.district, post.place.city].filter(Boolean).join(", ") || "Local place"}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-sm">
                  <Heart className="h-4 w-4 fill-cyan-200 text-cyan-200" />
                  {post.likeCount}
                </div>
              </div>
              <p className="text-sm leading-6 text-white/76">{post.caption}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {post.rating && <span className="rounded-full bg-amber-200/12 px-2 py-1 text-xs text-amber-100"><Star className="mr-1 inline h-3 w-3" />{post.rating}/5</span>}
                {post.moodTags.map((tag) => <span key={tag} className="rounded-full bg-white/[0.06] px-2 py-1 text-xs text-white/56">#{tag}</span>)}
              </div>
              <p className="mt-4 text-xs text-white/44">by {post.author.name}</p>
            </div>
          </article>
        )}
        <Button asChild className={`mt-4 w-full rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100 ${interactiveClass}`}>
          <Link href="/hunt">Open Nearloy Hunt</Link>
        </Button>
      </section>
    </main>
  );
}
