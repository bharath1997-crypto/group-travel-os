import { fetchDirectoryStates } from "@/app/(dashboard)/explore/explore-directory-api";

export const revalidate = 14400;

export async function GET() {
  const states = await fetchDirectoryStates().catch(() => []);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://rovvy.app";
  const urls: string[] = [`${origin}/explore`];

  for (const state of states) {
    urls.push(`${origin}/explore/${state.slug}`);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${loc}</loc></url>`).join("\n")}
</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
