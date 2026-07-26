import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomePage } from "@/components/home-page";
import { isLanguage, PAGE_METADATA } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return PAGE_METADATA.home[isLanguage(locale) ? locale : "zh"];
}

export default async function LocalizedHomePage({ params }: Props) {
  const { locale } = await params;
  if (!isLanguage(locale)) notFound();
  return <HomePage language={locale} />;
}
