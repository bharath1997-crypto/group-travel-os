export const CATEGORY_DEFAULT_IMAGES: Record<string, string[]> = {
  Food: [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400",
    "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=400",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400",
  ],
  Nightlife: [
    "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=400",
    "https://images.unsplash.com/photo-1470225626100-bba66d435341?w=400",
    "https://images.unsplash.com/photo-1514933654661-420338547875?w=400",
    "https://images.unsplash.com/photo-1572116463536-3eab5efb3a86?w=400",
    "https://images.unsplash.com/photo-1567740790761-266c558ba05a?w=400",
  ],
  Shopping: [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400",
    "https://images.unsplash.com/photo-1445209000759-98b02c2c2a67?w=400",
    "https://images.unsplash.com/photo-1555529667-3a2fa4a9c87e?w=400",
    "https://images.unsplash.com/photo-1528698484350-52fd39093e69?w=400",
    "https://images.unsplash.com/photo-1472851293957-34aa37465f95?w=400",
  ],
  Parks: [
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400",
    "https://images.unsplash.com/photo-1511497587188-69a69227d4?w=400",
    "https://images.unsplash.com/photo-1506905925346-14da524339?w=400",
    "https://images.unsplash.com/photo-1464822759023-fed62259c0?w=400",
  ],
  Gaming: [
    "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400",
    "https://images.unsplash.com/photo-1511517798256-9fe201423668?w=400",
    "https://images.unsplash.com/photo-1542759562-0046a95267a3?w=400",
    "https://images.unsplash.com/photo-1511884649-8c89841d0e9?w=400",
    "https://images.unsplash.com/photo-1552820726-219c1a2c0?w=400",
  ],
  Amusement: [
    "https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=400",
    "https://images.unsplash.com/photo-1596436889106-a3c9a109a71?w=400",
    "https://images.unsplash.com/photo-1502086250355-59ad676b806?w=400",
    "https://images.unsplash.com/photo-1576610616550-42b8e788?w=400",
    "https://images.unsplash.com/photo-1563720723-6c472329f?w=400",
  ],
  Trekking: [
    "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400",
    "https://images.unsplash.com/photo-1464829823060-9a1d0b6?w=400",
    "https://images.unsplash.com/photo-1506905925346-14da524339?w=400",
    "https://images.unsplash.com/photo-1682687219800-b292412?w=400",
    "https://images.unsplash.com/photo-1551637763-c872?w=400",
  ],
  Landmarks: [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
    "https://images.unsplash.com/photo-1496564799988-8e69-2e1698e1417f?w=400",
    "https://images.unsplash.com/photo-1502602898657-3e71750bb17a?w=400",
    "https://images.unsplash.com/photo-1518568814500-bf9f399f47ee?w=400",
    "https://images.unsplash.com/photo-1545569341-9ebf0f1085e1?w=400",
  ],
  Events: [
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400",
    "https://images.unsplash.com/photo-1501281668745?w=400",
    "https://images.unsplash.com/photo-1470229729835-492056?w=400",
    "https://images.unsplash.com/photo-1511575428491?w=400",
    "https://images.unsplash.com/photo-1492684227-775?w=400",
  ],
  Activities: [
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400",
    "https://images.unsplash.com/photo-1571902940602-78fbf?w=400",
    "https://images.unsplash.com/photo-1521335625502?w=400",
    "https://images.unsplash.com/photo-1518611012117?w=400",
    "https://images.unsplash.com/photo-1541534741688?w=400",
  ],
  Sports: [
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400",
    "https://images.unsplash.com/photo-1574629810360-4755?w=400",
    "https://images.unsplash.com/photo-1575367371284-0728?w=400",
    "https://images.unsplash.com/photo-1579952363873-81602?w=400",
    "https://images.unsplash.com/photo-1517644531023-f5f?w=400",
  ],
  default: [
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400",
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400",
    "https://images.unsplash.com/photo-1501785888041-4693ba7b9023?w=400",
    "https://images.unsplash.com/photo-1526772662000-3f88f10405?w=400",
  ],
};

export function getPlaceImage(
  imageUrl: string | null | undefined,
  category: string,
  id: string,
): string {
  if (imageUrl && imageUrl.startsWith("http")) return imageUrl;
  const images =
    CATEGORY_DEFAULT_IMAGES[category] || CATEGORY_DEFAULT_IMAGES.default;
  const index =
    Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) %
    images.length;
  return images[index];
}
