import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);
const TOAST_DURATION = 4200;

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2 1 21h22L12 2zm0 15.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zM11 10h2v4h-2z" /></svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2a10 10 0 1 0 .01 20A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z" /></svg>
  ),
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 220);
  }, []);

  const toast = useCallback((message, type = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
    setTimeout(() => dismiss(id), TOAST_DURATION);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div id="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type} ${t.leaving ? "leaving" : ""}`} onClick={() => dismiss(t.id)}>
            <span className="toast-icon">{ICONS[t.type] || ICONS.info}</span>
            <span className="toast-message">{t.message}</span>
            <span className="toast-progress" style={{ animationDuration: `${TOAST_DURATION}ms` }} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

