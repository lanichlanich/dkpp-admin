import "server-only";
import source from "@/data/anjab-abk.json";
import type { SourceCatalog } from "@/lib/anjab-abk-calculation";

export const anjabCatalog = source as SourceCatalog;
