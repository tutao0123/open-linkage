import type { Metadata } from "next";
import { SixBarLegLab } from "@/components/six-bar-leg-lab";

export const metadata: Metadata = {
  title: "六杆腿实验室 · OpenLinkage",
  description: "参数化编辑、仿真和分析 Watt 类六杆腿机构。",
};

export default function LegLabPage() {
  return <SixBarLegLab />;
}
