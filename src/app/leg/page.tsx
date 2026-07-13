import type { Metadata } from "next";
import { SixBarLegLab } from "@/components/six-bar-leg-lab";

export const metadata: Metadata = {
  title: "六杆机械腿轨迹综合 · OpenLinkage",
  description: "手绘足端轨迹，自动生成并比较多套兼顾轨迹精度、连续装配和传动性能的 Watt 类六杆腿。",
};

export default function LegLabPage() {
  return <SixBarLegLab />;
}
