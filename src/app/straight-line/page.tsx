import type { Metadata } from "next";

import { StraightLineWorkbench } from "@/components/straight-line-workbench";

export const metadata: Metadata = {
  title: "经典直线机构工作台 · OpenLinkage",
  description: "比较瓦特、彻比雪夫、霍肯与波塞利耶–利普金机构的直线行程、偏差和速度均匀性。",
};

export default function StraightLinePage() {
  return <StraightLineWorkbench />;
}
