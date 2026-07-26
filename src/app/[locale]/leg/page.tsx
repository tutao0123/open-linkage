import type { Metadata } from "next";
import { SixBarLegLab } from "@/components/six-bar-leg-lab";
import { isLanguage, PAGE_METADATA } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return PAGE_METADATA.leg[isLanguage(locale) ? locale : "zh"];
}

export default function LegLabPage() {
  return <SixBarLegLab />;
}
