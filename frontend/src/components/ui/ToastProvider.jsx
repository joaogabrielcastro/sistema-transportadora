import React, { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useToast } from "./useToast.js";
import { ToastContext } from "./ToastContext.js";

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
      <div className="fixed right-4 top-20 z-[1000] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "rounded-lg border bg-white shadow-lg",
              "px-4 py-3",
              "transition-all duration-200",
              t.type === "success" && "border-success/30",
              t.type === "error" && "border-danger/30",
              t.type === "warning" && "border-yellow-500/30",
              t.type === "info" && "border-border",
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
          >
            <div className="flex items-start gap-3">
              <div
                className={[
                  "mt-0.5 h-2.5 w-2.5 rounded-full",
                  t.type === "success" && "bg-success",
                  t.type === "error" && "bg-danger",
                  t.type === "warning" && "bg-yellow-500",
                  t.type === "info" && "bg-secondary",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              <div className="min-w-0 flex-1">
                {t.title && (
                  <div className="text-sm font-semibold text-text-primary">
                    {t.title}
                  </div>
                )}
                <div className="text-sm text-text-secondary break-words">
                  {t.message}
                </div>
              </div>
              <button
                type="button"
                className="ml-2 text-text-light hover:text-text-secondary rounded-md p-1"
                onClick={() => remove(t.id)}
                aria-label="Fechar"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

ToastProvider.propTypes = {
  children: PropTypes.node,
};

