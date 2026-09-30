import type { WorkLocation } from "@/lib/wfh-schedule";

export function continueFridayStatuses(previous: WorkLocation[], count: number): WorkLocation[] {
  if (previous.length === 0) return [];
  const cycle = previous.slice(-4);
  return Array.from({ length: count }, (_, index) => cycle[index % cycle.length]);
}
