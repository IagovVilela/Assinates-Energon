import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";

const messages = { "pt-BR": ptBR, en } as const;
export type AppLocaleTag = keyof typeof messages;

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("locale")?.value;
  const accept = (await headers()).get("accept-language") ?? "";
  const locale: AppLocaleTag =
    cookieLocale === "en" || cookieLocale === "pt-BR"
      ? cookieLocale
      : accept.toLowerCase().startsWith("en")
        ? "en"
        : "pt-BR";
  return { locale, messages: messages[locale] };
});
