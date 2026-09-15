import type { GroupConvergeMember } from "./live-group-converge-mock";

export type NightFinishedSummary = {
  destinationName: string;
  arrivedCount: number;
  memberCount: number;
  headline: string;
  subline: string;
  totalSpent: number;
  currency: string;
  perPersonLabel: string;
};

export type TripExpenseTotal = {
  total: number;
  currency: string;
  expenseCount: number;
};

export function sumTripExpenses(
  expenses: Array<{ amount: number; currency: string }>,
): TripExpenseTotal | null {
  if (!expenses.length) return null;
  const currency = expenses[0]?.currency ?? "USD";
  const sameCurrency = expenses.every((expense) => expense.currency === currency);
  if (!sameCurrency) return null;
  return {
    total: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    currency,
    expenseCount: expenses.length,
  };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}

export function buildNightFinishedSummary(input: {
  destinationName: string;
  members: GroupConvergeMember[];
  memberCount: number;
  expenseTotal: TripExpenseTotal | null;
  arrivedCount?: number | null;
  arrivalSubline?: string | null;
}): NightFinishedSummary {
  const fallbackArrivedCount = Math.max(
    1,
    input.members.filter(
      (member) => member.status !== "stale" && member.etaMinutes != null && member.etaMinutes <= 8,
    ).length,
  );
  const arrivedCount = input.arrivedCount ?? fallbackArrivedCount;
  const memberCount = Math.max(input.memberCount, input.members.length, 1);

  const staleMembers = input.members.filter((member) => member.status === "stale");
  const lateMembers = input.members.filter((member) => member.status === "late" && !member.isSelf);

  const sublineParts: string[] = [];
  if (input.arrivalSubline?.trim()) {
    sublineParts.push(input.arrivalSubline.trim());
  } else {
    if (lateMembers[0]) {
      sublineParts.push(`${lateMembers[0].name} ${lateMembers[0].etaLabel} out`);
    }
    if (staleMembers[0]) {
      sublineParts.push(`${staleMembers[0].name} hasn't moved recently`);
    }
    if (sublineParts.length === 0) {
      sublineParts.push("Everyone else is on the way or already here.");
    }
  }

  const totalSpent = input.expenseTotal?.total ?? 186;
  const currency = input.expenseTotal?.currency ?? "USD";
  const perPerson = Math.round(totalSpent / memberCount);

  return {
    destinationName: input.destinationName,
    arrivedCount,
    memberCount,
    headline:
      arrivedCount >= memberCount
        ? "Everyone made it in."
        : `${arrivedCount} of ${memberCount} are in.`,
    subline: sublineParts.join(". "),
    totalSpent,
    currency,
    perPersonLabel: `${formatMoney(perPerson, currency)} each at ${memberCount}`,
  };
}

export function splitActivitiesHref(tripId: string | null): string {
  if (tripId) return `/split-activities?trip_id=${encodeURIComponent(tripId)}`;
  return "/split-activities";
}

export function buildSettleOpenedNotice(
  summary: Pick<NightFinishedSummary, "headline" | "totalSpent" | "currency">,
): string {
  return `Night wrapped · ${summary.headline} · ${formatMoney(summary.totalSpent, summary.currency)} to split`;
}
