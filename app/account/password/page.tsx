import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  await requireUser();
  return <PasswordChangeForm />;
}
