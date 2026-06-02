export const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  Food: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80",
  Nightlife:
    "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=400&q=80",
  Shopping:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=80",
  Parks:
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80",
  Gaming:
    "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&q=80",
  Amusement:
    "https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=400&q=80",
  Trekking:
    "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80",
  Landmarks:
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
  Events:
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&q=80",
  Activities:
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80",
  Sports:
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&q=80",
  default:
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80",
};

export function getPlaceImage(
  imageUrl: string | null | undefined,
  category: string,
): string {
  if (imageUrl && imageUrl.startsWith("http")) return imageUrl;
  return CATEGORY_DEFAULT_IMAGES[category] || CATEGORY_DEFAULT_IMAGES.default;
}
