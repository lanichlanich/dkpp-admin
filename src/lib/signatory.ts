import { z } from "zod";

export const signatorySchema = z.object({
  name: z.string().trim().min(1, "Nama pejabat wajib diisi.").max(160).regex(/^[^<>\x00-\x1f{}]+$/),
  nip: z.union([z.literal(""), z.string().regex(/^\d{18}$/, "NIP pejabat harus 18 digit.")]),
  rank: z.string().trim().max(100).regex(/^[^<>\x00-\x1f{}]*$/),
  title: z.string().trim().min(1, "Jabatan penandatangan wajib diisi.").max(180).regex(/^[^<>\x00-\x1f{}]+$/),
  status: z.enum(["definitif", "plt"]),
});
export type Signatory = z.infer<typeof signatorySchema>;
export type SignatoryOption = Signatory & { id: string };
export const DEFAULT_SIGNATORY: Signatory = {
  name: "RORY FIRMANSYAH, S.STP, M.Si.", nip: "", rank: "",
  title: "KEPALA DINAS KETAHANAN PANGAN DAN PERTANIAN KABUPATEN INDRAMAYU", status: "plt",
};
export function signatoryTitle(value: Signatory) {
  const title = value.title.replace(/^Plt\.?\s*/i, "").trim();
  return `${value.status === "plt" ? "Plt. " : ""}${title}`;
}
export function signatoryRank(value: string) {
  const parts = value.split(/\s+\/\s+/).filter((part) => part.toLowerCase() !== "null");
  const grade = parts.find((part) => /^(?:I|II|III|IV)\/[a-e]$/i.test(part));
  return { name: parts.filter((part) => part !== grade).join(" / "), full: [...parts.filter((part) => part !== grade), ...(grade ? [grade] : [])].join(" / ") };
}
