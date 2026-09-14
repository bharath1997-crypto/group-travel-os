import { apiFetch } from "@/lib/safe-fetch";
import { getToken } from "@/lib/auth";
import { sumTripExpenses, type TripExpenseTotal } from "./live-night-finished";

type TripExpenseRow = {
  amount: number;
  currency: string;
};

export async function fetchTripExpenseTotal(tripId: string): Promise<TripExpenseTotal | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const expenses = await apiFetch<TripExpenseRow[]>(`/trips/${tripId}/expenses`);
    return sumTripExpenses(expenses);
  } catch {
    return null;
  }
}
