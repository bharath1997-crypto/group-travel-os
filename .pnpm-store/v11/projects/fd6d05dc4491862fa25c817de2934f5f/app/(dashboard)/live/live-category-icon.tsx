import {
  Anchor,
  Banknote,
  Building2,
  Church,
  Coffee,
  Fuel,
  GraduationCap,
  Hospital,
  Hotel,
  Landmark,
  Library,
  MapPin,
  Mountain,
  Palmtree,
  ParkingCircle,
  Plane,
  Search,
  Trees,
  Utensils,
  Waves,
  Wine,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  waterfalls: Waves,
  mountains: Mountain,
  forests: Trees,
  rock_formations: Mountain,
  national_parks: Trees,
  parks: Trees,
  rivers: Waves,
  canals: Waves,
  lakes: Waves,
  beaches: Palmtree,
  ports: Anchor,
  airports: Plane,
  viewpoints: Landmark,
  museums: Landmark,
  food: Utensils,
  coffee: Coffee,
  cinemas: Building2,
  gas: Fuel,
  liquor: Wine,
  hotel: Hotel,
  hospital: Hospital,
  parking: ParkingCircle,
  restroom: Building2,
  atm: Banknote,
  churches: Church,
  libraries: Library,
  schools: GraduationCap,
  landmarks: Landmark,
};

type LiveCategoryIconProps = {
  categoryKey: string;
  className?: string;
};

export function LiveCategoryIcon({ categoryKey, className = "h-4 w-4 text-[#0F1614]" }: LiveCategoryIconProps) {
  const Icon = CATEGORY_ICONS[categoryKey] ?? Search;
  return <Icon className={className} strokeWidth={1.9} aria-hidden />;
}

export function LivePlacePinIcon({ className = "h-4 w-4 text-[#0F1614]" }: { className?: string }) {
  return <MapPin className={className} strokeWidth={1.9} aria-hidden />;
}
