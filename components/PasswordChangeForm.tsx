"use client";

import { CheckCircle2, KeyRound, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";

export function PasswordChangeForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("Das neue Passwort braucht mindestens 8 Zeichen.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Die neuen Passwoerter stimmen nicht ueberein.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    setSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Passwort konnte nicht geaendert werden.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Passwort geaendert.");
  }

  return (
    <main className="phone-shell min-h-dvh bg-[#f6f6f7] pb-8">
      <AppHeader title="Konto" back chrome={false} />

      <section className="px-5 pt-6">
        <div className="rounded-[28px] bg-neutral-950 p-5 text-white shadow-[0_18px_38px_rgba(0,0,0,0.22)]">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10">
            <KeyRound size={23} />
          </div>
          <h1 className="mt-4 text-[28px] font-bold leading-8">Passwort ändern</h1>
          <p className="mt-2 text-[14px] leading-5 text-white/60">Nutze hier dein Startpasswort und setze danach dein eigenes Passwort.</p>
        </div>
      </section>

      <form onSubmit={submit} className="mx-5 mt-5 space-y-3">
        <PasswordInput label="Aktuelles Passwort" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
        <PasswordInput label="Neues Passwort" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
        <PasswordInput label="Neues Passwort wiederholen" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />

        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700 ring-1 ring-red-100">{error}</p> : null}
        {message ? (
          <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[14px] font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-200">
            <CheckCircle2 size={18} />
            {message}
          </p>
        ) : null}

        <button type="submit" disabled={saving} className="ios-button h-14 w-full rounded-2xl bg-neutral-950 text-[17px] font-bold text-white shadow-[0_14px_26px_rgba(0,0,0,0.18)] disabled:opacity-60">
          {saving ? "Speichern..." : "Passwort speichern"}
        </button>
        <button type="button" onClick={() => router.push("/staff/calendar")} className="ios-button h-12 w-full rounded-2xl bg-white text-[15px] font-bold text-neutral-900 shadow-sm ring-1 ring-neutral-200">
          Zurueck zur App
        </button>
      </form>
    </main>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-neutral-100">
        <LockKeyhole size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold text-neutral-500">{label}</span>
        <input
          type="password"
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 w-full border-0 bg-transparent text-[16px] font-semibold outline-none"
        />
      </span>
    </label>
  );
}
