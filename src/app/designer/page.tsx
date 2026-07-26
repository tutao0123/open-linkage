import { redirect } from "next/navigation";

export default async function LegacyDesignerPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; transfer?: string }>;
}) {
  const query = new URLSearchParams();
  const { template, transfer } = await searchParams;
  if (template) query.set("template", template);
  if (transfer) query.set("transfer", transfer);
  redirect(`/zh/designer${query.size ? `?${query.toString()}` : ""}`);
}
