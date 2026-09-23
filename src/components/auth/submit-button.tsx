"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 w-full bg-indigo-600 text-white hover:bg-indigo-700">
      {pending && <LoaderCircle className="size-4 animate-spin" />}
      {pending ? "Memproses..." : children}
    </Button>
  );
}
