import type { Metadata } from "next";
import { FourBarLab } from "@/components/four-bar-lab";

export const metadata: Metadata = {
  title: "四杆机构实验室 · OpenLinkage",
  description: "输入杆长并实时分析平面四杆机构的运动、轨迹与工程性能。",
};

export default function LabPage() {
  return <FourBarLab />;
}
