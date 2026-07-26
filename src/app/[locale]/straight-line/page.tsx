import type { Metadata } from "next";
import { StraightLineWorkbench } from "@/components/straight-line-workbench";
import { isLanguage, PAGE_METADATA } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return PAGE_METADATA.straightLine[isLanguage(locale) ? locale : "zh"];
}

export default function StraightLinePage() {
  return <StraightLineWorkbench />;
}
