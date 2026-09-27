import type { SeatShareCurrency } from "./seats-currency";

export type Money = { amount_paise: number; display: string; currency?: SeatShareCurrency };

export function formatSeatShareMoney(
  minorUnits: number,
  currency: SeatShareCurrency,
): Money {
  const major = minorUnits / 100;
  const display = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(major);
  return { amount_paise: minorUnits, display, currency };
}

export function formatPaise(paise: number): Money {
  return formatSeatShareMoney(paise, "INR");
}

export function reformatSeatShareMoney(m: Money, currency: SeatShareCurrency): Money {
  if (m.currency === currency) return m;
  return formatSeatShareMoney(m.amount_paise, currency);
}

export function formatTimeIst(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
