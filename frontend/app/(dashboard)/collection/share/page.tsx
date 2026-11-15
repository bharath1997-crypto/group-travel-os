"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { extractSharedUrl } from "../collection-link";

/**
 * Android share sheet target (PWA Web Share Target, GET).
 * Instagram, YouTube, X and others send the link in `url` or inside `text`.
 * We hand it to the Collection paste box and read it once.
 */
function ShareLanding() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const link = extractSharedUrl({
      url: params.get("url"),
      text: params.get("text"),
      title: params.get("title"),
    });
    // A share with no web link (plain text) is not dropped silently: the page explains it.
    router.replace(link ? `/collection?q=${encodeURIComponent(link)}&shared=1` : "/collection?shared=none");
  }, [params, router]);

  return <p style={{ padding: 24 }}>Opening your collection…</p>;
}

export default function CollectionSharePage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Opening your collection…</p>}>
      <ShareLanding />
    </Suspense>
  );
}
