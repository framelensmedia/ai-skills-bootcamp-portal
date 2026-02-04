"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

type AuthContextType = {
    user: User | null;
    session: Session | null;
    initialized: boolean;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [initialized, setInitialized] = useState(false);
    const router = useRouter();

    // Use the singleton client
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        let mounted = true;

        async function init() {
            // 1. Get initial session
            const { data: { session: initialSession } } = await supabase.auth.getSession();

            if (!mounted) return;

            if (initialSession) {
                setSession(initialSession);
                setUser(initialSession.user);
            }

            setInitialized(true);
        }

        init();

        // 2. Listen for changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession: Session | null) => {
            if (!mounted) return;

            setSession(newSession);
            setUser(newSession?.user ?? null);
            setInitialized(true);

            if (event === "SIGNED_OUT") {
                setSession(null);
                setUser(null);
                router.refresh(); // Ensure server components re-render with no auth
            }

            if (event === "SIGNED_IN") {
                router.refresh();
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [supabase, router]);

    const signOut = async () => {
        await supabase.auth.signOut();
        router.refresh();
    };

    return (
        <AuthContext.Provider value={{ user, session, initialized, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
