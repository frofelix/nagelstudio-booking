"use client";

import { Check, X } from "lucide-react";

export type AppPickerOption = {
  value: string;
  label: string;
  detail?: string;
};

export function AppPickerSheet({
  title,
  options,
  value,
  onClose,
  onSelect
}: {
  title: string;
  options: AppPickerOption[];
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] mx-auto flex w-[min(100vw,430px)] items-end bottom-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="max-h-[74vh] w-full overflow-y-auto rounded-t-[30px] bg-white px-5 pb-5 pt-3 shadow-[0_-18px_42px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-neutral-300" />
        <div className="mb-4 flex items-center justify-between">
          <span className="h-10 w-10" />
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-200">
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelect(option.value)}
                className={`ios-button flex min-h-[58px] w-full items-center justify-between gap-3 px-4 text-left active:bg-neutral-50 ${
                  index === options.length - 1 ? "" : "border-b border-neutral-100"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-bold text-neutral-950">{option.label}</span>
                  {option.detail ? <span className="mt-0.5 block truncate text-[12px] font-semibold text-neutral-500">{option.detail}</span> : null}
                </span>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${selected ? "bg-neutral-950 text-white" : "bg-neutral-100 text-transparent"}`}>
                  <Check size={16} strokeWidth={2.4} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
