import type { Metadata } from "next";
import { FreeMechanismDesigner } from "@/components/free-mechanism-designer";
import { isLanguage, PAGE_METADATA } from "@/lib/i18n";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ template?: string; transfer?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return PAGE_METADATA.designer[isLanguage(locale) ? locale : "zh"];
}

export default async function DesignerPage({ searchParams }: Props) {
  const { template, transfer } = await searchParams;
  return <FreeMechanismDesigner initialTemplateId={template} loadTransfer={transfer === "variable-leg"} />;
}
