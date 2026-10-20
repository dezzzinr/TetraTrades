"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

export type ConfirmOptions = {
  /** Short heading, e.g. "Cancel this order?" */
  title: string;
  /** Optional longer explanation of what will happen. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red and swaps the icon for a warning triangle. */
  danger?: boolean;
};

type ConfirmRequest = ConfirmOptions & { id: number; resolve: (value: boolean) => void };

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Wraps a subtree with a single global confirmation-dialog instance: call
// `useConfirm()` anywhere beneath it to `await confirm({...})` before running
// a mutating action. Requests queue (one dialog visible at a time) so two
// near-simultaneous calls never fight over the same modal.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  const idRef = useRef(0);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      idRef.current += 1;
      setQueue((q) => [...q, { ...options, id: idRef.current, resolve }]);
    });
  }, []);

  const current = queue[0];

  const respond = (value: boolean) => {
    if (!current) return;
    current.resolve(value);
    setQueue((q) => q.slice(1));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) respond(false); }}>
          <div className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title">
            <div className={`confirm-modal-icon${current.danger ? " danger" : ""}`}>
              {current.danger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
            </div>
            <h2 id="confirm-modal-title">{current.title}</h2>
            {current.message && <p>{current.message}</p>}
            <div className="confirm-modal-actions">
              <button type="button" className="outline-btn" onClick={() => respond(false)} autoFocus>
                {current.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                className={current.danger ? "primary-btn reject-btn" : "primary-btn"}
                onClick={() => respond(true)}
              >
                {current.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// Returns a function: `const confirm = useConfirm(); if (!(await confirm({ title: "..." }))) return;`
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm() must be used within a <ConfirmProvider>");
  return ctx;
}
