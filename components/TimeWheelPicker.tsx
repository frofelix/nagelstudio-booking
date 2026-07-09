"use client";

import { X } from "lucide-react";
import { forwardRef, RefObject, useEffect, useMemo, useRef, useState } from "react";

type TimeWheelPickerProps = {
  title: string;
  value: string;
  onClose: () => void;
  onApply: (value: string) => void;
};

export function TimeWheelPicker({ title, value, onClose, onApply }: TimeWheelPickerProps) {
  const [hour, setHour] = useState(value.slice(0, 2));
  const [minute, setMinute] = useState(value.slice(3, 5));
  const hours = useMemo(() => Array.from({ length: 17 }, (_, index) => (index + 6).toString().padStart(2, "0")), []);
  const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  function scrollToValue(ref: RefObject<HTMLDivElement>, values: string[], nextValue: string) {
    const index = values.indexOf(nextValue);
    const itemHeight = 44;
    ref.current?.scrollTo({ top: Math.max(0, index) * itemHeight, behavior: "smooth" });
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollToValue(hourRef, hours, hour);
      scrollToValue(minuteRef, minutes, minute);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex w-[min(100vw,430px)] items-end bottom-sheet-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="w-full rounded-t-[28px] bg-white px-5 pb-5 pt-2 shadow-[0_-20px_50px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
      <div className="mx-auto mb-2 h-1 w-14 rounded-full bg-neutral-300" />
      <div className="flex items-center justify-between">
        <span className="h-10 w-10" />
        <h2 className="text-base font-semibold">{title}</h2>
        <button type="button" aria-label="Schliessen" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full active:bg-neutral-100">
          <X size={22} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-2 rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
        <div className="relative grid grid-cols-[1fr_24px_1fr] items-center gap-3">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-white shadow-sm ring-1 ring-neutral-200" />
          <WheelColumn ref={hourRef} label="Stunde" values={hours} value={hour} onChange={(next) => {
            setHour(next);
            scrollToValue(hourRef, hours, next);
          }} />
          <span className="relative z-10 text-center text-[18px] font-semibold">:</span>
          <WheelColumn ref={minuteRef} label="Minute" values={minutes} value={minute} onChange={(next) => {
            setMinute(next);
            scrollToValue(minuteRef, minutes, next);
          }} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onApply(`${hour}:${minute}`)}
        className="ios-button mt-4 h-12 w-full rounded-2xl bg-neutral-900 text-[16px] font-semibold text-white shadow-sm"
      >
        Übernehmen
      </button>
      </div>
    </div>
  );
}

type WheelColumnProps = {
  label: string;
  values: string[];
  value: string;
  onChange: (value: string) => void;
};

const WheelColumn = forwardRef<HTMLDivElement, WheelColumnProps>(function WheelColumn({ label, values, value, onChange }, ref) {
  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const itemHeight = 44;
    const index = Math.max(0, Math.min(values.length - 1, Math.round(event.currentTarget.scrollTop / itemHeight)));
    const next = values[index];
    if (next && next !== value) onChange(next);
  }

  return (
    <div
      ref={ref}
      aria-label={label}
      onScroll={handleScroll}
      className="relative z-10 h-[132px] snap-y snap-mandatory overflow-y-auto overscroll-contain py-11 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {values.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`ios-button h-11 w-full snap-center rounded-xl text-center text-[20px] font-semibold ${
            option === value ? "text-neutral-950" : "text-neutral-400"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
});
