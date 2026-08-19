import type { Metadata } from "next";

import { OdysseyVariableLegExperience } from "@/components/odyssey-variable-leg-experience";
import { isLanguage } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const language = isLanguage(locale) ? locale : "zh";
  const title = language === "zh" ? "会走的特洛伊木马 | OpenLinkage" : "The Walking Trojan Horse | OpenLinkage";
  const description = language === "zh"
    ? "把特洛伊木马外壳与真实 Jansen 连杆运动学结合起来的 OpenLinkage 奥德赛特别版。"
    : "An Odyssey special edition that combines a Trojan horse shell with live Jansen linkage kinematics.";
  return {
    title,
    description,
    alternates: { canonical: `/${language}/variable-leg-sp-version` },
    openGraph: {
      title,
      description,
      images: [{ url: "https://linkage.wtt.autos/863689e7-d348-4759-a1ca-0cbdbfeb54fa.png", width: 1024, height: 1536, alt: "Trojan horse mechanism study" }],
    },
  };
}

export default async function VariableLegSpecialVersionPage({ params }: Props) {
  const { locale } = await params;
  const language = isLanguage(locale) ? locale : "zh";
  return <OdysseyVariableLegExperience language={language} />;
}
