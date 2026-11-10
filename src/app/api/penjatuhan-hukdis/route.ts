import { saveDisciplineCaseRequest } from "@/lib/discipline-case-api";
export const runtime = "nodejs";
export function POST(request: Request) { return saveDisciplineCaseRequest(request); }
