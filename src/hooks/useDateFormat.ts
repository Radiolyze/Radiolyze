import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  formatDate,
  formatDateTime,
  formatShortDate,
  formatTime,
  type DateInput,
} from "@/lib/date";

/**
 * Date and time formatters bound to the active UI language.
 *
 * Subscribing to i18next through `useTranslation` is what makes formatted dates
 * follow a language switch: the component re-renders and the formatters are
 * rebuilt for the new locale.
 */
export function useDateFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language || "en";

  return useMemo(
    () => ({
      locale,
      formatDate: (value: DateInput) => formatDate(value, locale),
      formatTime: (value: DateInput) => formatTime(value, locale),
      formatShortDate: (value: DateInput) => formatShortDate(value, locale),
      formatDateTime: (value: DateInput) => formatDateTime(value, locale),
    }),
    [locale],
  );
}
