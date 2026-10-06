import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, X, Check, Copy } from "./icons";

export const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
export const num = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-US")
    : "pending";
export const date = (s: string | null | undefined) =>
  !s
    ? "Pending"
    : new Date(s).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
export const amount = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 4 });
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "purple";
}) {
  return (
    <span className={`badge ${tone}`}>
      {tone === "green" && <Check size={11} aria-hidden="true" />}
      {children}
    </span>
  );
}
export function EvidenceLink({
  hash,
  label = "View transaction",
}: {
  hash: string;
  label?: string;
}) {
  return (
    <a
      className="evidence-link"
      href={`https://eth.blockscout.com/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} ${short(hash)} (opens in a new tab)`}
    >
      {label}
      <ArrowUpRight size={13} aria-hidden="true" />
    </a>
  );
}
export function Address({ value }: { value: string }) {
  return (
    <a
      className="address"
      href={`https://eth.blockscout.com/address/${value}`}
      target="_blank"
      rel="noreferrer"
      title={value}
      aria-label={`Address ${value} (opens in a new tab)`}
    >
      {short(value)}
      <ArrowUpRight size={12} aria-hidden="true" />
    </a>
  );
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const trigger = document.activeElement as HTMLElement;
    el?.showModal();
    return () => {
      el?.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <div className="dialog-top">
        <div>
          <span className="eyebrow">Evidence workspace</span>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function CopyButton({
  value,
  notify,
}: {
  value: string;
  notify: (message: string) => void;
}) {
  return (
    <button
      className="icon-button"
      title="Copy address"
      aria-label="Copy full address"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          notify("Address copied.");
        } catch {
          notify(
            "Clipboard unavailable. Select and copy the address in the evidence details.",
          );
        }
      }}
    >
      <Copy size={14} />
    </button>
  );
}
export function download(name: string, content: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
