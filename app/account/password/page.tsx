import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { requireUser } from "@/lib/auth";

export default async function PasswordPage() {
  await requireUser();
  return <PasswordChangeForm />;
}
