import { WorkingHoursClient } from "@/components/WorkingHoursClient";
import { requireUser } from "@/lib/auth";

export default async function StaffWorkingHoursPage() {
  const user = await requireUser();
  return <WorkingHoursClient employeeId={user.employeeId} />;
}
