import type { Metadata } from "next";
import { FourBarLab } from "@/components/four-bar-lab";
import { isLanguage, PAGE_METADATA } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return PAGE_METADATA.lab[isLanguage(locale) ? locale : "zh"];
}

export default function LabPage() {
  return <FourBarLab />;
}
