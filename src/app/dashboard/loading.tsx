import { PageLoading } from "@/components/ui/page-loading";

export default function DashboardLoading() {
  // Keep loading inside DashboardLayout's main content so navigation stays visible.
  return <PageLoading />;
}
