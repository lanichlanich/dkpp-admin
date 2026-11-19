import { PlanningWorkspace } from "@/components/planning/planning-workspace";
import { requireMenuAccess } from "@/lib/authorization";
import { jakartaToday } from "@/lib/plt-dates";
import { PLANNING_MENU, YEARS } from "@/lib/planning/model";
import { loadPlanning, planningView, PlanningError } from "@/lib/planning/store";

export default async function PlanningPage() {
  const user = await requireMenuAccess(PLANNING_MENU);
  const today = jakartaToday();
  const year = Math.max(YEARS[0], Math.min(YEARS.at(-1)!, Number(today.slice(0, 4))));
  const quarter = Math.ceil(Number(today.slice(5, 7)) / 3);
  const context = await loadPlanning(user, year, quarter).catch(error => {
    if (error instanceof PlanningError) return error;
    throw error;
  });
  if (context instanceof PlanningError) {
    return <section className="space-y-3">
      <p className="font-medium text-emerald-800">Perencanaan</p>
      <h1 className="text-3xl font-semibold">Pagu, Target &amp; Realisasi</h1>
      <p role="status" className="rounded-xl border bg-white p-4 text-base">{context.message}</p>
    </section>;
  }
  return <PlanningWorkspace initial={planningView(context)} />;
}
