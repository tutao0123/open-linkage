import type { Metadata } from "next";
import { VariableGeometryLegLab } from "@/components/variable-geometry-leg-lab";
import { isLanguage, PAGE_METADATA } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return PAGE_METADATA.variableLeg[isLanguage(locale) ? locale : "zh"];
}

export default function VariableLegPage() {
  return <VariableGeometryLegLab />;
}
