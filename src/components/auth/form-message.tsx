import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormMessage({ status, message }: { status?: "success" | "error"; message?: string }) {
  if (!message) return null;
  const Icon = status === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div role="status" className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm", status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700")}>
      <Icon className="mt-0.5 size-4 shrink-0" /><span>{message}</span>
    </div>
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs leading-5 text-red-600">{messages[0]}</p>;
}
