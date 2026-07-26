import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { LocaleShell } from "@/components/locale-shell";
import { isLanguage, LANGUAGES } from "@/lib/i18n";

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGUAGES.map((locale) => ({ locale }));
}

export default async function LocalizedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLanguage(locale)) notFound();
  return <LocaleShell language={locale}>{children}</LocaleShell>;
}
