import type { AppLocale } from "@prisma/client";

export function localeTag(locale: AppLocale) {
  return locale === "EN" ? "en" : "pt-BR";
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
