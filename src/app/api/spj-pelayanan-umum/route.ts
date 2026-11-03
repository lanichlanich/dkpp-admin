import { checkApiAccess } from "@/lib/authorization";
import { getSpjOptions } from "@/lib/spj-service";
import { spjResponse } from "@/lib/spj-api";
export async function GET() {
  const denied = await checkApiAccess(["spj-pelayanan-umum"]); if (denied) return denied;
  return spjResponse(getSpjOptions);
}
