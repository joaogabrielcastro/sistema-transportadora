import React, { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useToast } from "./useToast.js";
import { ToastContext } from "./ToastContext.js";
import Icon from "./Icon.jsx";

const TOAST_TONES = {
  success: { icon: "check", badge: "bg-emerald-100 text-emerald-700" },
  error: { icon: "x", badge: "bg-red-100 text-red-700" },
  warning: { icon: "alert", badge: "bg-amber-100 text-amber-700" },
  info: { icon: "info", badge: "bg-sky-100 text-sky-700" },
};

const DEFAULT_DURATION_MS = 3500;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    ({ type = "info", title, message, durationMs = DEFAULT_DURATION_MS }) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const toast = { id, type, title, message };
      setToasts((prev) => [...prev, toast]);
      window.setTimeout(() => remove(id), durationMs);
      return id;
    },
    [remove],
  );

  const api = useMemo(
    () => ({
      show,
      success: (message, opts = {}) => show({ type: "success", message, ...opts }),
      error: (message, opts = {}) => show({ type: "error", message, ...opts }),
      info: (message, opts = {}) => show({ type: "info", message, ...opts }),
      warning: (message, opts = {}) => show({ type: "warning", message, ...opts }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[1200] flex flex-col gap-2 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:w-[400px]"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const tone = TOAST_TONES[t.type] || TOAST_TONES.info;
          return (
            <div
              key={t.id}
              className="pointer-events-auto animate-pop-in rounded-xl border border-border bg-white px-3.5 py-3 shadow-pop"
              role={t.type === "error" ? "alert" : "status"}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.badge}`}
                  aria-hidden
                >
                  <Icon name={tone.icon} className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  {t.title && (
                    <div className="text-sm font-semibold text-text-primary">
                      {t.title}
                    </div>
                  )}
                  <div className="break-words text-sm leading-5 text-text-primary">
                    {t.message}
                  </div>
                </div>
                <button
                  type="button"
                  className="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-light hover:bg-slate-100 hover:text-text-secondary"
                  onClick={() => remove(t.id)}
                  aria-label="Fechar notificação"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

ToastProvider.propTypes = {
  children: PropTypes.node,
};

