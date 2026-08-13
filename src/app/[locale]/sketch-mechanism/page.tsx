import type { Metadata } from "next";

import { SketchLinkageLab } from "@/components/sketch-linkage-lab";
import { isLanguage, PAGE_METADATA } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return PAGE_METADATA.sketchMechanism[isLanguage(locale) ? locale : "zh"];
}

export default function SketchMechanismPage() {
  return <SketchLinkageLab />;
}
