// frontend/src/components/ui/Modal.jsx
import React, { useEffect, useId, useRef } from "react";
import PropTypes from "prop-types";

const Modal = ({
  isOpen = false,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = "",
}) => {
  const modalRef = useRef();
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-full mx-4",
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (closeOnEscape && e.key === "Escape" && onCloseRef.current) {
        onCloseRef.current();
      }
    };

    const handleTabTrap = (e) => {
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", handleTabTrap);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (modalRef.current) {
      modalRef.current.focus();
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleTabTrap);
      document.body.style.overflow = previousOverflow;
    };
    // Só quando abre: `onClose` inline no pai mudava a cada tecla e o
    // painel (tabIndex=-1) roubava o foco do input.
  }, [isOpen, closeOnEscape]);

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby={title ? titleId : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex min-h-screen items-end justify-center px-3 pt-4 text-center sm:block sm:p-0"
        onClick={handleOverlayClick}
      >
        {/* Background overlay */}
        <div
          className="fixed inset-0 z-0 bg-slate-950/55 backdrop-blur-[1px]"
          aria-hidden="true"
        />

        {/* Center modal */}
        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        {/* Modal panel */}
        <div
          ref={modalRef}
          tabIndex={-1}
          className={`relative z-10 inline-block max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-t-2xl border border-border bg-white text-left shadow-xl sm:my-8 sm:align-middle sm:rounded-xl ${sizes[size]} ${className}`}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="sticky top-0 z-10 border-b border-border bg-white px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                {title && (
                  <h3
                    className="text-lg font-semibold text-text-primary"
                    id={titleId}
                  >
                    {title}
                  </h3>
                )}
                {showCloseButton && (
                  <button
                    type="button"
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-slate-100 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                    onClick={onClose}
                    aria-label="Fechar modal"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="bg-white px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        </div>
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  children: PropTypes.node,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl", "full"]),
  showCloseButton: PropTypes.bool,
  closeOnOverlayClick: PropTypes.bool,
  closeOnEscape: PropTypes.bool,
  className: PropTypes.string,
};

export default Modal;
