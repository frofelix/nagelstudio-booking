import { AdminDashboardClient } from "@/components/AdminDashboardClient";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPage();
  return <AdminDashboardClient />;
}
