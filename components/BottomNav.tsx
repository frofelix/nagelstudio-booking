"use client";

import Link from "next/link";
import { CalendarDays, Clock3 } from "lucide-react";

type BottomNavProps = {
  active: "calendar" | "working-hours";
};

export function BottomNav({ active }: BottomNavProps) {
  const itemClass = (key: BottomNavProps["active"]) =>
    `ios-button flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold ${
      active === key ? "bg-neutral-100 text-black" : "text-neutral-500"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto h-[86px] w-[min(100vw,430px)] border-t border-neutral-200/80 bg-white/92 px-8 pb-4 pt-2 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between gap-3 rounded-3xl bg-white/60 p-1">
        <Link href="/staff/calendar" className={itemClass("calendar")}>
          <CalendarDays size={24} fill={active === "calendar" ? "currentColor" : "none"} strokeWidth={1.9} />
          <span>Kalender</span>
        </Link>
        <Link href="/staff/working-hours" className={itemClass("working-hours")}>
          <Clock3 size={24} fill={active === "working-hours" ? "currentColor" : "none"} strokeWidth={1.9} />
          <span>Arbeitszeiten</span>
        </Link>
      </div>
    </nav>
  );
}
