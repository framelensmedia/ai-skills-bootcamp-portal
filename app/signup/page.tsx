"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Eye, EyeOff } from "lucide-react";


export default function SignupPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreedToTerms) {
      setError("You must agree to the Terms and Conditions to sign up.");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // For MVP, we assume email confirmation is off

    // Attempt tracking referral
    await fetch("/api/ambassador/track-referral", { method: "POST" });

    // Send to GHL
    try {
      // Split name for GHL
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      await fetch("/api/integrations/ghl/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          source: "Email Signup"
        }),
      });
    } catch (err) {
      console.error("GHL Hook failed", err);
    }

    // Failsafe: Explicitly update profile name in case DB trigger missed metadata
    // (This ensures the name is saved even if the SQL trigger wasn't updated)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ full_name: fullName }).eq("user_id", user.id);
    }

    import("@/lib/gtm").then(({ trackEvent }) => {
      trackEvent("signup_completed", { method: "email" });
    });

    router.push("/welcome");
  };

  const handleGoogleLogin = async () => {
    // Google login implies agreement, or we could force a check differently. 
    // Usually for OAuth, the terms are linked in the "Continue with" text or implied.
    // For now, let's keep it simple.

    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-6">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-white/70">
          Start free. Upgrade anytime.
        </p>

        <form onSubmit={onSubmit} className="space-y-4 shadow-lg">
          <div className="space-y-2">
            <label className="text-sm text-white/80">Full Name</label>
            <input
              type="text"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/25"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/80">Email</label>
            <input
              type="email"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/25"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/80">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/25 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 py-2">
            <div className="relative flex items-center h-5">
              <input
                id="terms"
                type="checkbox"
                className="h-4 w-4 rounded border-white/10 bg-black/30 text-lime-400 focus:ring-lime-400 focus:ring-offset-black"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
            </div>
            <label htmlFor="terms" className="text-xs text-white/60 leading-relaxed">
              I agree to the <Link href="/terms" className="text-white hover:text-lime-400 underline decoration-white/30 hover:decoration-lime-400" target="_blank">Terms of Service</Link> and <Link href="/privacy" className="text-white hover:text-lime-400 underline decoration-white/30 hover:decoration-lime-400" target="_blank">Privacy Policy</Link>.
            </label>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div className="relative mt-4 mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#18181b] px-2 text-white/50">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm font-semibold text-white hover:bg-black/50"
          >
            Log in
          </button>
        </div>
      </div>
    </div>

  );
}
