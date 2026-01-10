"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

export function ToastContextProvider({ children }: { children: ReactNode }) {
    // We'll manage the toast visibility in the Provider component itself for clearer separation
    // But we need to Expose the Setter.
    // Actually, standard pattern: Custom Hook exposes the method, Context holds the method.

    // We'll use an Event Bus pattern or State Lift? 
    // State Lift is cleaner for React.

    const [toast, setToast] = useState<{ message: string; type: ToastType; id: number } | null>(null);

    const showToast = (message: string, type: ToastType = "success") => {
        setToast({ message, type, id: Date.now() });
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* We render the UI here OR in a separate component that consumes the context */}
            {/* Let's render here to avoid extra files if possible, or use a separate Presentation component */}
            <ToastUI toast={toast} onClose={() => setToast(null)} />
        </ToastContext.Provider>
    );
}

// Internal presentation component
import { RefreshCw, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useEffect } from "react";

function ToastUI({ toast, onClose }: { toast: { message: string; type: ToastType; id: number } | null, onClose: () => void }) {
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [toast, onClose]);

    if (!toast) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-zinc-900 border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className={`${toast.type === 'success' ? 'text-[#B7FF00]' : toast.type === 'error' ? 'text-red-500' : 'text-blue-400'}`}>
                {toast.type === 'success' && <CheckCircle size={18} />}
                {toast.type === 'error' && <AlertCircle size={18} />}
                {toast.type === 'info' && <RefreshCw size={18} className="animate-spin" />}
            </div>
            <span className="font-bold text-sm w-max max-w-[80vw] truncate">{toast.message}</span>
        </div>
    );
}
