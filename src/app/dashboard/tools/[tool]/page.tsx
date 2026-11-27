import { notFound } from "next/navigation";
import { PdfToolForm } from "@/components/tools/pdf-tool-form";
import { requireMenuAccess } from "@/lib/authorization";
import { pdfTools } from "@/lib/pdf-tools-config";

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  return { title: pdfTools.find(item => item.slug === tool)?.label ?? "Tools" };
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const config = pdfTools.find(item => item.slug === tool);
  if (!config) notFound();
  await requireMenuAccess(config.slug);
  return <div className="mx-auto max-w-3xl space-y-6">
    <header><p className="text-sm font-medium text-emerald-700">Tools</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{config.label}</h1><p className="mt-2 text-sm text-muted-foreground">{config.description}</p></header>
    <PdfToolForm key={config.slug} tool={config} />
  </div>;
}
