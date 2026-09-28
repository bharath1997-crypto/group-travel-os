"use client";

import { useCallback, useState } from "react";
import {
  type DateQuickPreset,
  matchesExploreDateFilter,
} from "@/lib/explore-date-utils";

export function useExploreDateFilter(initialDate: string | null = null) {
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [datePreset, setDatePreset] = useState<DateQuickPreset>(null);

  const onDateChange = useCallback(
    (date: string | null, preset?: DateQuickPreset) => {
      setSelectedDate(date);
      setDatePreset(preset ?? null);
    },
    [],
  );

  const matchesEvent = useCallback(
    (eventDate?: string | null) =>
      matchesExploreDateFilter(eventDate, selectedDate, datePreset),
    [selectedDate, datePreset],
  );

  return { selectedDate, datePreset, onDateChange, matchesEvent };
}
