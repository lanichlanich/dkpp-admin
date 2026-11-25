import { z } from "zod";

export const legalSearchInput = z.object({
  query: z.string().trim().min(5).max(160).regex(/^[^\x00-\x1f\x7f]+$/),
}).strict().refine(({ query }) => !/(?:\d[\s.-]*){16,}|https?:\/\/|\S+@\S+/i.test(query));

export const legalSearchResult = z.object({
  results: z.array(z.object({ dasar: z.string().trim().min(8).max(400).regex(/^[^\x00-\x1f\x7f]+$/), url: z.url().max(1600) }).strict()).max(5),
}).strict();
