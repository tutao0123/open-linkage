import type { Metadata } from "next";

import { FreeMechanismDesigner } from "@/components/free-mechanism-designer";

export const metadata: Metadata = {
  title: "自由机构设计器 · OpenLinkage",
  description: "自由添加铰点和杆件，搭建、驱动并观察平面 N 杆机构的运动轨迹。",
};

export default async function DesignerPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; transfer?: string }>;
}) {
  const { template, transfer } = await searchParams;
  return <FreeMechanismDesigner initialTemplateId={template} loadTransfer={transfer === "variable-leg"} />;
}
