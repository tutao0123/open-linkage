import type { Metadata } from "next";

import { VariableGeometryLegLab } from "@/components/variable-geometry-leg-lab";

export const metadata: Metadata = {
  title: "可变几何步行腿 · OpenLinkage",
  description: "以克兰腿和简森腿为基础，通过移动固定铰点或可锁止伸缩杆，同时拟合巡航、高速与越障足端轨迹。",
};

export default function VariableLegPage() {
  return <VariableGeometryLegLab />;
}
