"use client";

import { ArrowLeft, KeyRound, LogOut, Menu, Shield, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AppHeaderProps = {
  title: string;
  back?: boolean;
  chrome?: boolean;
  statusBar?: boolean;
  rightAction?: ReactNode;
  adminShortcut?: boolean;
  accountShortcut?: boolean;
};

export function AppHeader({ title, back = false, chrome = true, statusBar = true, rightAction, adminShortcut = false, accountShortcut = false }: AppHeaderProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if ((!chrome && !adminShortcut && !accountShortcut) || back) return;
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setIsAdmin(data.user?.role === "owner" || data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, [adminShortcut, back, chrome]);

  const showLeftButton = back || chrome;
  const showAccountButton = accountShortcut || (!rightAction && !back && chrome);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/92 backdrop-blur-xl">
      {statusBar ? <StatusBar /> : null}
      <div className="relative flex h-[58px] items-center justify-center px-5">
        {showLeftButton ? (
          <button
            type="button"
            aria-label={back ? "Zurueck" : isAdmin ? "Admin-Bereich" : "Menue"}
            onClick={() => (back ? router.back() : isAdmin ? router.push("/admin") : undefined)}
            className="absolute left-5 grid h-10 w-10 place-items-center rounded-full bg-neutral-100/80 text-neutral-950 ring-1 ring-neutral-200/70 active:bg-neutral-200"
          >
            {back ? <ArrowLeft size={23} strokeWidth={1.8} /> : isAdmin ? <Shield size={22} strokeWidth={1.8} /> : <Menu size={25} strokeWidth={1.8} />}
          </button>
        ) : null}
        <h1 className="max-w-[300px] truncate text-center text-[18px] font-semibold leading-none tracking-normal">{title}</h1>
        {rightAction ? <div className="absolute right-5">{rightAction}</div> : null}
        {!rightAction && !back && showAccountButton ? (
          <div className="absolute right-5">
          <button
            type="button"
            aria-label="Konto"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100/80 text-neutral-950 ring-1 ring-neutral-200/70 active:bg-neutral-200"
          >
            <UserRound size={21} strokeWidth={1.8} />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-3xl bg-white text-left shadow-[0_18px_42px_rgba(0,0,0,0.18)] ring-1 ring-neutral-200">
              {isAdmin ? (
                <MenuButton icon={<Shield size={18} />} label="Admin-Bereich" onClick={() => router.push("/admin")} />
              ) : null}
              <MenuButton icon={<KeyRound size={18} />} label="Passwort ändern" onClick={() => router.push("/account/password")} />
              <MenuButton icon={<LogOut size={18} />} label="Abmelden" onClick={logout} />
            </div>
          ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function MenuButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-12 w-full items-center gap-3 px-4 text-[14px] font-semibold text-neutral-900 active:bg-neutral-100">
      {icon}
      {label}
    </button>
  );
}

function StatusBar() {
  return (
    <div className="flex h-[34px] items-end justify-between px-9 pb-1 text-[13px] font-semibold leading-none text-black">
      <span>9:41</span>
      <div className="flex items-end gap-1.5">
        <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
          <span className="block h-1.5 w-[3px] rounded-sm bg-black" />
          <span className="block h-2 w-[3px] rounded-sm bg-black" />
          <span className="block h-2.5 w-[3px] rounded-sm bg-black" />
          <span className="block h-3 w-[3px] rounded-sm bg-black" />
        </span>
        <span className="block h-3 w-4 rounded-[3px] border border-black" aria-hidden="true">
          <span className="block m-[2px] h-[6px] rounded-sm bg-black" />
        </span>
      </div>
    </div>
  );
}
