import { Suspense } from "react";
import { ManualBookingForm } from "@/components/ManualBookingForm";
import { requireUser } from "@/lib/auth";

export default async function NewBookingPage() {
  await requireUser();
  return (
    <Suspense>
      <ManualBookingForm />
    </Suspense>
  );
}
