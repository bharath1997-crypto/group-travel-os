export type GroupConvergeMemberStatus = "on_track" | "late" | "stale";

export type GroupConvergeMember = {
  id: string;
  name: string;
  initials: string;
  avatarClassName: string;
  ringClassName: string;
  detail: string;
  etaMinutes: number | null;
  etaLabel: string;
  status: GroupConvergeMemberStatus;
  isSelf?: boolean;
};

export type GroupWayraNotice = {
  headline: string;
  actions: { id: string; label: string }[];
};

export function formatLastOneInTime(etaMinutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + etaMinutes);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function buildDefaultConvergeMembers(yourEtaMinutes = 6): GroupConvergeMember[] {
  return [
    {
      id: "you",
      name: "You",
      initials: "MJ",
      avatarClassName: "bg-[#DCEAE5] text-[#0A4A3E]",
      ringClassName: "border-[#6FE0C0]",
      detail: "driving · 1.4 mi",
      etaMinutes: yourEtaMinutes,
      etaLabel: `${yourEtaMinutes} min`,
      status: "on_track",
      isSelf: true,
    },
    {
      id: "ana",
      name: "Ana",
      initials: "AR",
      avatarClassName: "bg-[#F0E5D2] text-[#7A5A22]",
      ringClassName: "border-[#6FE0C0]",
      detail: "walking · 0.5 mi",
      etaMinutes: 8,
      etaLabel: "8 min",
      status: "on_track",
    },
    {
      id: "tomas",
      name: "Tomas",
      initials: "TK",
      avatarClassName: "bg-[#E4E1F2] text-[#474079]",
      ringClassName: "border-[#C9BFFF]",
      detail: "running late · traffic on 90",
      etaMinutes: 22,
      etaLabel: "22 min",
      status: "late",
    },
    {
      id: "sam",
      name: "Sam",
      initials: "SM",
      avatarClassName: "bg-[#D8D5CC] text-[#5A615A]",
      ringClassName: "border-[rgba(168,176,170,0.65)]",
      detail: "location 4 min old",
      etaMinutes: null,
      etaLabel: "Nudge",
      status: "stale",
    },
  ];
}

export function lastOneInMinutes(members: GroupConvergeMember[]): number {
  const etas = members
    .map((member) => member.etaMinutes)
    .filter((value): value is number => value != null);
  return etas.length > 0 ? Math.max(...etas) : 8;
}

export const DEFAULT_GROUP_WAYRA_NOTICE: GroupWayraNotice = {
  headline: "Tomas is 14 min behind everyone else.",
  actions: [
    { id: "order-drink", label: "Order his drink now" },
    { id: "move-table", label: "Move the table to 7:40" },
  ],
};
