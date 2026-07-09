"use client";

import { LockKeyhole, Mail, Scissors } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("lisa@nailstudio.test");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const next = searchParams.get("next") || "/staff/calendar";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      setError("E-Mail oder Passwort stimmt nicht.");
      setLoading(false);
      return;
    }

    const data = await response.json();

    if (data.user?.mustChangePassword) {
      setMustChangePassword(true);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function changeInitialPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordChangeError("");

    if (newPassword.length < 8) {
      setPasswordChangeError("Das neue Passwort braucht mindestens 8 Zeichen.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError("Die Passwoerter stimmen nicht ueberein.");
      return;
    }

    setPasswordSaving(true);
    const response = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: password, newPassword })
    });

    setPasswordSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setPasswordChangeError(typeof data.error === "string" ? data.error : "Passwort konnte nicht gespeichert werden.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <main className="phone-shell flex min-h-dvh flex-col bg-[#f6f6f7] px-5 pb-8 pt-14">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-[24px] bg-neutral-950 text-white shadow-[0_16px_30px_rgba(0,0,0,0.18)]">
        <Scissors size={29} />
      </div>
      <div className="mt-8 text-center">
        <h1 className="text-[32px] font-bold tracking-tight text-neutral-950">Anmelden</h1>
        <p className="mt-2 text-[15px] leading-6 text-neutral-500">Melde dich mit deinem Mitarbeiterzugang an.</p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <label className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-neutral-100">
            <Mail size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-neutral-500">E-Mail</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full border-0 bg-transparent text-[16px] font-semibold outline-none"
            />
          </span>
        </label>

        <label className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-neutral-100">
            <LockKeyhole size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-neutral-500">Passwort</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full border-0 bg-transparent text-[16px] font-semibold outline-none"
              placeholder="Passwort"
            />
          </span>
        </label>

        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700 ring-1 ring-red-100">{error}</p> : null}

        <button type="submit" disabled={loading} className="ios-button h-14 w-full rounded-2xl bg-neutral-950 text-[17px] font-bold text-white shadow-[0_14px_26px_rgba(0,0,0,0.18)] disabled:opacity-60">
          {loading ? "Anmelden..." : "Einloggen"}
        </button>
      </form>

      <p className="mt-auto rounded-3xl bg-white px-4 py-4 text-center text-[13px] font-medium leading-5 text-neutral-500 shadow-sm ring-1 ring-neutral-200">
        Admins sehen danach die Verwaltung. Mitarbeiter landen direkt in der Mitarbeiter-App.
      </p>

      {mustChangePassword ? (
        <div className="fixed inset-0 z-50 mx-auto flex w-[min(100vw,430px)] items-end bottom-sheet-backdrop">
          <div className="w-full rounded-t-[30px] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_42px_rgba(0,0,0,0.18)]">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-neutral-300" />
            <h2 className="text-center text-[20px] font-bold text-neutral-950">Neues Passwort festlegen</h2>
            <p className="mt-2 text-center text-[14px] leading-5 text-neutral-500">Du hast dich mit einem Startpasswort angemeldet. Bitte lege jetzt dein eigenes Passwort fest.</p>

            <form onSubmit={changeInitialPassword} className="mt-5 space-y-3">
              <InitialPasswordInput label="Neues Passwort" value={newPassword} onChange={setNewPassword} />
              <InitialPasswordInput label="Neues Passwort wiederholen" value={confirmPassword} onChange={setConfirmPassword} />
              {passwordChangeError ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700 ring-1 ring-red-100">{passwordChangeError}</p> : null}
              <button type="submit" disabled={passwordSaving} className="ios-button h-13 h-12 w-full rounded-2xl bg-neutral-950 text-[16px] font-bold text-white disabled:opacity-60">
                {passwordSaving ? "Speichern..." : "Passwort speichern"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function InitialPasswordInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-neutral-200">
        <LockKeyhole size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold text-neutral-500">{label}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 w-full border-0 bg-transparent text-[16px] font-semibold outline-none"
        />
      </span>
    </label>
  );
}
