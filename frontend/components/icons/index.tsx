"use client";

import type React from "react";

const NAVY = "#1C2B3A";
const PINK = "#E8619A";
const WHITE = "#FFFFFF";

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  active?: boolean;
  darkBg?: boolean;
  filled?: boolean;
  hasBadge?: boolean;
};

export type IconComponent = React.FC<IconProps>;

function strokeFor(active?: boolean, darkBg?: boolean) {
  if (active) return PINK;
  return darkBg ? WHITE : NAVY;
}

function LineIcon({
  children,
  size = 24,
  className = "",
  active = false,
  darkBg = false,
  ...props
}: Omit<IconProps, "children"> & {
  children: (stroke: string) => React.ReactNode;
}) {
  const stroke = strokeFor(active, darkBg);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {children(stroke)}
    </svg>
  );
}

const line = (stroke: string, d: string) => (
  <path d={d} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
);
const circle = (stroke: string, cx: number, cy: number, r: number, fill = "none") => (
  <circle cx={cx} cy={cy} r={r} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={fill} />
);
const rect = (stroke: string, x: number, y: number, width: number, height: number, rx = 2, fill = "none") => (
  <rect x={x} y={y} width={width} height={height} rx={rx} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={fill} />
);

export function IconLayoutDashboard(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 3, 3, 7, 7, 1)}{rect(s, 14, 3, 7, 7, 1)}{rect(s, 3, 14, 7, 7, 1)}{rect(s, 14, 14, 7, 7, 1)}</>}</LineIcon>;
}

export function IconPlane(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M22 12H18L15 21L12 12L9 3L6 12H2")}</LineIcon>;
}

export function IconUsers(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M17 21V19C17 16.8 15.2 15 13 15H5C2.8 15 1 16.8 1 19V21")}{circle(s, 9, 7, 4)}{line(s, "M23 21V19C23 17.2 21.8 15.7 20 15.2")}{line(s, "M16 3.2C17.8 3.7 19 5.2 19 7C19 8.8 17.8 10.3 16 10.8")}</>}</LineIcon>;
}

export function IconBanknote(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 2, 6, 20, 12, 2)}{circle(s, 12, 12, 2)}{line(s, "M6 10H6.01M18 14H18.01")}</>}</LineIcon>;
}

export function IconLive(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 3)}{line(s, "M7.8 7.8C5.5 10.1 5.5 13.9 7.8 16.2")}{line(s, "M16.2 7.8C18.5 10.1 18.5 13.9 16.2 16.2")}{line(s, "M4.9 4.9C1 8.8 1 15.2 4.9 19.1")}{line(s, "M19.1 4.9C23 8.8 23 15.2 19.1 19.1")}</>}</LineIcon>;
}

export function IconCompass(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 10)}{line(s, "M16.2 7.8L14.1 14.1L7.8 16.2L9.9 9.9L16.2 7.8Z")}</>}</LineIcon>;
}

export function IconMap(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M3 6L9 3L15 6L21 3V18L15 21L9 18L3 21V6Z")}{line(s, "M9 3V18M15 6V21")}</>}</LineIcon>;
}

export function IconCloudSun(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M16.5 18.5H6.5C5.1 18.5 4 17.4 4 16C4 14.6 5.1 13.5 6.5 13.5C6.7 11.7 8.2 10.5 10 10.5C11.3 10.5 12.4 11.1 13.1 12.1C13.8 11.7 14.6 11.5 15.5 11.5C17.7 11.5 19.5 13.3 19.5 15.5")}{circle(s, 17, 7, 3)}{line(s, "M17 1V3M17 11V13M11 7H13M21 7H23")}</>}</LineIcon>;
}

export function IconBarChart(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M18 20V10")}{line(s, "M12 20V4")}{line(s, "M6 20V14")}</>}</LineIcon>;
}

export function IconBarChart3(props: IconProps) {
  return <IconBarChart {...props} />;
}

export function IconBell({ hasBadge, ...props }: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z")}{line(s, "M13.7 21A2 2 0 0 1 10.3 21")}{hasBadge ? <circle cx="18" cy="5" r="2" fill={PINK} stroke="none" /> : null}</>}</LineIcon>;
}

export function IconBellOff(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z")}{line(s, "M13.7 21A2 2 0 0 1 10.3 21")}{line(s, "M1 1L23 23")}</>}</LineIcon>;
}

export function IconLogout(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M9 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H9")}{line(s, "M16 17L21 12L16 7")}{line(s, "M21 12H9")}</>}</LineIcon>;
}

export function IconMenu(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M4 6H20M4 12H20M4 18H20")}</LineIcon>;
}

export function IconMoreHorizontal(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 5, 12, 1)}{circle(s, 12, 12, 1)}{circle(s, 19, 12, 1)}</>}</LineIcon>;
}

export function IconCheck(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M20 6L9 17L4 12")}</LineIcon>;
}

export function IconX(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M18 6L6 18")}{line(s, "M6 6L18 18")}</>}</LineIcon>;
}

export function IconMapPin(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M12 21C12 21 20 16 20 10A8 8 0 0 0 4 10C4 16 12 21 12 21Z")}{circle(s, 12, 10, 2.5)}</>}</LineIcon>;
}

export function IconArrowLeft(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M19 12H5M5 12L12 19M5 12L12 5")}</LineIcon>;
}

export function IconShare(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M12 3V15M12 3L7 8M12 3L17 8")}{line(s, "M5 12V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V12")}</>}</LineIcon>;
}

export function IconSettings(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 3)}{line(s, "M12 2V5M12 19V22M4.9 4.9L7 7M17 17L19.1 19.1M2 12H5M19 12H22M4.9 19.1L7 17M17 7L19.1 4.9")}</>}</LineIcon>;
}

export function IconGrid(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 3, 3, 6, 6, 1)}{rect(s, 15, 3, 6, 6, 1)}{rect(s, 3, 15, 6, 6, 1)}{rect(s, 15, 15, 6, 6, 1)}</>}</LineIcon>;
}

export function IconClapperboard(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 2, 7, 20, 14, 2)}{line(s, "M2 7L6 3L10 7L14 3L18 7L22 3")}</>}</LineIcon>;
}

export function IconBookmark({ filled, active, darkBg, ...props }: IconProps) {
  const s = strokeFor(active, darkBg);
  const fill = filled || active ? PINK : "none";
  return <LineIcon active={active} darkBg={darkBg} {...props}>{() => lineWithFill(s, "M5 3H19C20.1 3 21 3.9 21 5V21L12 17L3 21V5C3 3.9 3.9 3 5 3Z", fill)}</LineIcon>;
}

function lineWithFill(stroke: string, d: string, fill: string) {
  return <path d={d} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={fill} />;
}

export function IconUserSquare(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 3, 3, 18, 18, 2)}{circle(s, 12, 9, 3)}{line(s, "M7 18C7 15.8 9.2 14 12 14C14.8 14 17 15.8 17 18")}</>}</LineIcon>;
}

export function IconMessageCircle(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M21 11.5A8.5 8.5 0 0 1 8.7 19.1L3 21L4.9 15.3A8.5 8.5 0 1 1 21 11.5Z")}</LineIcon>;
}

export function IconMessageSquare(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M21 15C21 16.1 20.1 17 19 17H7L3 21V5C3 3.9 3.9 3 5 3H19C20.1 3 21 3.9 21 5V15Z")}</LineIcon>;
}

export function IconPlay({ active, darkBg, ...props }: IconProps) {
  const s = strokeFor(active, darkBg);
  return <LineIcon active={active} darkBg={darkBg} {...props}>{() => lineWithFill(s, "M5 3L19 12L5 21V3Z", active ? PINK : "none")}</LineIcon>;
}

export function IconChevronRight(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M9 5L16 12L9 19")}</LineIcon>;
}

export function IconChevronDown(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M6 9L12 15L18 9")}</LineIcon>;
}

export function IconCalendarPlus(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 3, 5, 18, 16, 2)}{line(s, "M16 3V7M8 3V7M3 11H21M12 11V17M9 14H15")}</>}</LineIcon>;
}

export function IconCalendar(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 3, 4, 18, 18, 2)}{line(s, "M16 2V6M8 2V6M3 10H21")}</>}</LineIcon>;
}

export function IconUser(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 8, 4)}{line(s, "M4 20C4 16.7 6.7 14 10 14H14C17.3 14 20 16.7 20 20")}</>}</LineIcon>;
}

export function IconUserCircle(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 10)}{circle(s, 12, 8, 3)}{line(s, "M6 18C6 15 9 13 12 13C15 13 18 15 18 18")}</>}</LineIcon>;
}

export function IconEdit(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M12 20H21")}{line(s, "M16.5 3.5L20.5 7.5L7 21L3 22L4 18L17.5 4.5")}</>}</LineIcon>;
}

export function IconCamera(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M3 7H7L9 4H15L17 7H21C22.1 7 23 7.9 23 9V19C23 20.1 22.1 21 21 21H3C1.9 21 1 20.1 1 19V9C1 7.9 1.9 7 3 7Z")}{circle(s, 12, 14, 4)}</>}</LineIcon>;
}

export function IconLock(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 5, 11, 14, 10, 2)}{line(s, "M7 11V7C7 4.8 8.8 3 11 3H13C15.2 3 17 4.8 17 7V11")}</>}</LineIcon>;
}

export function IconShield(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z")}</LineIcon>;
}

export function IconShieldOff(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z")}{line(s, "M1 1L23 23")}</>}</LineIcon>;
}

export function IconSearch(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 11, 11, 8)}{line(s, "M21 21L16.7 16.7")}</>}</LineIcon>;
}

export function IconHeart({ filled, active, darkBg, ...props }: IconProps) {
  const s = strokeFor(active, darkBg);
  return <LineIcon active={active} darkBg={darkBg} {...props}>{() => lineWithFill(s, "M20.8 4.6C18.8 2.6 15.6 2.6 13.6 4.6L12 6.2L10.4 4.6C8.4 2.6 5.2 2.6 3.2 4.6C1.1 6.7 1.1 10 3.2 12.1L12 21L20.8 12.1C22.9 10 22.9 6.7 20.8 4.6Z", filled || active ? PINK : "none")}</LineIcon>;
}

export function IconFilter(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M4 6H20")}{line(s, "M7 12H17")}{line(s, "M10 18H14")}</>}</LineIcon>;
}

export function IconStar({ filled, active, darkBg, ...props }: IconProps) {
  const s = strokeFor(active, darkBg);
  return <LineIcon active={active} darkBg={darkBg} {...props}>{() => lineWithFill(s, "M12 2L15.1 8.3L22 9.3L17 14.1L18.2 21L12 17.8L5.8 21L7 14.1L2 9.3L8.9 8.3L12 2Z", filled || active ? PINK : "none")}</LineIcon>;
}

export function IconSun(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 5)}{line(s, "M12 1V3M12 21V23M4.2 4.2L5.6 5.6M18.4 18.4L19.8 19.8M1 12H3M21 12H23M4.2 19.8L5.6 18.4M18.4 5.6L19.8 4.2")}</>}</LineIcon>;
}

export function IconGlobe(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 10)}{line(s, "M2 12H22")}{line(s, "M12 2C14.5 4.7 16 8.3 16 12C16 15.7 14.5 19.3 12 22C9.5 19.3 8 15.7 8 12C8 8.3 9.5 4.7 12 2Z")}</>}</LineIcon>;
}

export function IconVideo(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 1, 5, 15, 14, 2)}{line(s, "M23 7L16 12L23 17V7Z")}</>}</LineIcon>;
}

export function IconClock(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 10)}{line(s, "M12 6V12L16 14")}</>}</LineIcon>;
}

export function IconPaperclip(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M21.4 11.1L12.2 20.2A6 6 0 0 1 3.8 11.8L13.4 2.1A4 4 0 0 1 19.2 8L9.5 17.7A2 2 0 0 1 6.7 14.9L16.3 5")}</LineIcon>;
}

export function IconDollarSign(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M12 1V23")}{line(s, "M17 5H9.5A3.5 3.5 0 0 0 9.5 12H14.5A3.5 3.5 0 0 1 14.5 19H6")}</>}</LineIcon>;
}

export function IconMic(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 9, 1, 6, 14, 3)}{line(s, "M19 10V12A7 7 0 0 1 5 12V10")}{line(s, "M12 19V23M8 23H16")}</>}</LineIcon>;
}

export function IconSend(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M22 2L11 13")}{line(s, "M22 2L15 22L11 13L2 9L22 2Z")}</>}</LineIcon>;
}

export function IconAlertCircle(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 10)}{line(s, "M12 8V12")}<circle cx="12" cy="16" r="1" fill={s} stroke="none" /></>}</LineIcon>;
}

export function IconImage(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 3, 3, 18, 18, 2)}{circle(s, 8.5, 8.5, 1.5)}{line(s, "M21 15L16 10L5 21")}</>}</LineIcon>;
}

export function IconType(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M4 7V4H20V7")}{line(s, "M9 20H15")}{line(s, "M12 4V20")}</>}</LineIcon>;
}

export function IconArchive(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 3, 5, 18, 4, 1)}{line(s, "M5 9V20H19V9")}{line(s, "M10 13H14")}</>}</LineIcon>;
}

export function IconActivity(props: IconProps) {
  return <LineIcon {...props}>{(s) => line(s, "M22 12H18L15 21L9 3L6 12H2")}</LineIcon>;
}

export function IconBan(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 10)}{line(s, "M4.9 4.9L19.1 19.1")}</>}</LineIcon>;
}

export function IconAtSign(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 4)}{line(s, "M16 8V13A3 3 0 0 0 22 13V12A10 10 0 1 0 18.7 19.4")}</>}</LineIcon>;
}

export function IconUserPlus(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 9, 7, 4)}{line(s, "M2 21V19C2 16.8 3.8 15 6 15H12")}{line(s, "M19 8V14M16 11H22")}</>}</LineIcon>;
}

export function IconUserX(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 9, 7, 4)}{line(s, "M2 21V19C2 16.8 3.8 15 6 15H12")}{line(s, "M17 9L22 14M22 9L17 14")}</>}</LineIcon>;
}

export function IconHeartCrack(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M20.8 4.6C18.8 2.6 15.6 2.6 13.6 4.6L12 6.2L10.4 4.6C8.4 2.6 5.2 2.6 3.2 4.6C1.1 6.7 1.1 10 3.2 12.1L12 21L20.8 12.1C22.9 10 22.9 6.7 20.8 4.6Z")}{line(s, "M12 6L10 10L14 13L12 17")}</>}</LineIcon>;
}

export function IconCrown(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M2 7L7 12L12 5L17 12L22 7L19 20H5L2 7Z")}{line(s, "M5 16H19")}</>}</LineIcon>;
}

export function IconSmartphone(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 7, 2, 10, 20, 2)}{line(s, "M11 18H13")}</>}</LineIcon>;
}

export function IconTablet(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 5, 2, 14, 20, 2)}{line(s, "M11 18H13")}</>}</LineIcon>;
}

export function IconTv(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 3, 5, 18, 12, 2)}{line(s, "M8 21H16M12 17V21")}</>}</LineIcon>;
}

export function IconDownload(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M12 3V15M12 15L7 10M12 15L17 10")}{line(s, "M5 21H19")}</>}</LineIcon>;
}

export function IconAccessibility(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 4, 2)}{line(s, "M4 9H20M12 7V21M8 21L12 13L16 21")}</>}</LineIcon>;
}

export function IconLifeBuoy(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{circle(s, 12, 12, 10)}{circle(s, 12, 12, 4)}{line(s, "M4.9 4.9L9.2 9.2M14.8 14.8L19.1 19.1M19.1 4.9L14.8 9.2M9.2 14.8L4.9 19.1")}</>}</LineIcon>;
}

export function IconFileText(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z")}{line(s, "M14 2V8H20M8 13H16M8 17H16M8 9H10")}</>}</LineIcon>;
}

export function IconScale(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M12 3V21M5 21H19M6 6H18")}{line(s, "M6 6L3 14H9L6 6ZM18 6L15 14H21L18 6Z")}</>}</LineIcon>;
}

export function IconEye(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{line(s, "M2 12C4.5 7 8 5 12 5C16 5 19.5 7 22 12C19.5 17 16 19 12 19C8 19 4.5 17 2 12Z")}{circle(s, 12, 12, 3)}</>}</LineIcon>;
}

export function IconRobot(props: IconProps) {
  return <LineIcon {...props}>{(s) => <>{rect(s, 5, 7, 14, 12, 3)}{line(s, "M12 7V4")}{circle(s, 12, 3, 1.3)}{circle(s, 9, 12, 1.2, PINK)}{circle(s, 15, 12, 1.2, PINK)}{line(s, "M9 16H15")}</>}</LineIcon>;
}
