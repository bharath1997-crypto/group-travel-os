import {
  Ban,
  CircleDollarSign,
  Clock3,
  ParkingCircleOff,
  Users,
  Volume2,
  type LucideIcon,
} from "lucide-react";

export type LivePlaceReportType =
  | "long_line"
  | "packed"
  | "quiet"
  | "price_changed"
  | "closed_early"
  | "no_parking";

export type LivePlaceReportOption = {
  id: LivePlaceReportType;
  label: string;
  hint: string;
  icon: LucideIcon;
  iconClassName: string;
};

export const LIVE_PLACE_REPORT_OPTIONS: LivePlaceReportOption[] = [
  {
    id: "long_line",
    label: "Long line",
    hint: "how long?",
    icon: Clock3,
    iconClassName: "text-[#B4453D]",
  },
  {
    id: "packed",
    label: "Packed",
    hint: "standing room",
    icon: Users,
    iconClassName: "text-[#8D6A1E]",
  },
  {
    id: "quiet",
    label: "Quiet",
    hint: "tables free",
    icon: Volume2,
    iconClassName: "text-[#0E6E5C]",
  },
  {
    id: "price_changed",
    label: "Price changed",
    hint: "cover or menu",
    icon: CircleDollarSign,
    iconClassName: "text-[#2A312B]",
  },
  {
    id: "closed_early",
    label: "Closed early",
    hint: "saves the night",
    icon: Ban,
    iconClassName: "text-[#B4453D]",
  },
  {
    id: "no_parking",
    label: "No parking",
    hint: "circle 20 min",
    icon: ParkingCircleOff,
    iconClassName: "text-[#2A312B]",
  },
];

export const LIVE_PLACE_REPORT_DISCLAIMER =
  "Reports fade after two hours. Three matching reports mark a place confirmed.";

export type LivePlaceReportSummary = {
  reportType: LivePlaceReportType;
  lat: number;
  lng: number;
  placeName: string | null;
  placeKey: string | null;
  matchCount: number;
  confirmed: boolean;
  latestAt: string;
};

export function livePlaceReportLabel(type: LivePlaceReportType): string {
  return LIVE_PLACE_REPORT_OPTIONS.find((option) => option.id === type)?.label ?? type;
}
