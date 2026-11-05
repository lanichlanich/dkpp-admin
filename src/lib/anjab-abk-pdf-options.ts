import { z } from "zod";

export const anjabPdfSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }).strict(),
  z.object({ kind: z.literal("recap"), sheet: z.enum(["all", "perhitungan", "usulan", "penempatan"]) }).strict(),
  z.object({ kind: z.literal("detail"), familyId: z.string().min(1), levelId: z.string().min(1).optional() }).strict(),
]);
export type AnjabPdfSelection = z.infer<typeof anjabPdfSelectionSchema>;
