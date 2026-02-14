"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
    User,
    Save,
    Loader2,
    CheckCircle,
    XCircle,
    Shield,
    CreditCard,
    ArrowLeft
} from "lucide-react";
import Link from "next/link";
import Loading from "@/components/Loading";

export default function SettingsPage() {
    const router = useRouter();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [email, setEmail] = useState("");

    // Form State
    const [username, setUsername] = useState("");
    const [fullName, setFullName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // Status
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [checkingUsername, setCheckingUsername] = useState(false);

    // Debounce username check
    useEffect(() => {
        const checkAvailability = async () => {
            if (!username || username.length < 3) {
                setUsernameAvailable(null);
                return;
            }

            // Don't check if it's the user's current username (we'd need to know the initial value, skipped for simplicity)
            // Actually, we should check availability ONLY if it changed. 
            // For now, let's just implement the check.

            setCheckingUsername(true);

            // NOTE: This assumes RLS allows reading username from profiles.
            // If RLS blocks this, we might need an RPC function or API route.
            const { data, error } = await supabase
                .from("profiles")
                .select("id")
                .eq("username", username)
                .neq("user_id", userId) // exclude self
                .maybeSingle();

            setCheckingUsername(false);

            if (data) {
                setUsernameAvailable(false); // Taken
            } else {
                setUsernameAvailable(true); // Available
            }
        };

        const timer = setTimeout(checkAvailability, 500);
        return () => clearTimeout(timer);
    }, [username, userId, supabase]);

    useEffect(() => {
        let cancelled = false;

        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }

            setUserId(user.id);
            setEmail(user.email || "");

            const { data, error } = await supabase
                .from("profiles")
                .select("username, full_name, profile_image")
                .eq("user_id", user.id)
                .single();

            if (!cancelled && data) {
                setUsername(data.username || "");
                setFullName(data.full_name || "");
                setAvatarUrl(data.profile_image || null);
            }

            setLoading(false);
        }

        loadProfile();
        return () => { cancelled = true; };
    }, [router, supabase]);

    async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
        if (!userId) return;

        try {
            setUploading(true);
            if (!event.target.files || event.target.files.length === 0) {
                return;
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            // Use timestamp to avoid cache issues
            const fileName = `${userId}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            console.log("Uploading avatar:", filePath);

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) {
                console.error("Upload failed:", uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
            console.log("Avatar URL:", publicUrl);
            setAvatarUrl(publicUrl);

            // Auto-save to profile
            const { error: dbError } = await supabase
                .from("profiles")
                .update({ profile_image: publicUrl, updated_at: new Date().toISOString() })
                .eq("user_id", userId);

            if (dbError) {
                console.error("Profile update failed:", dbError);
                setMessage({ type: 'error', text: "Failed to save avatar to profile." });
            } else {
                setMessage({ type: 'success', text: "Profile photo updated!" });
            }

        } catch (error: any) {
            alert("Error uploading image: " + error.message);
        } finally {
            setUploading(false);
        }
    }

    async function handleSave() {
        if (!userId) return;

        // Validation
        if (username && !usernameAvailable && username.length >= 3) {
            setMessage({ type: 'error', text: "Username is already taken." });
            return;
        }

        setSaving(true);
        setMessage(null);

        const updates = {
            username: username || null,
            full_name: fullName || null,
            profile_image: avatarUrl,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from("profiles")
            .update(updates)
            .eq("user_id", userId);

        setSaving(false);

        if (error) {
            console.error("Profile save error:", error);
            setMessage({ type: 'error', text: `Failed: ${error.message || JSON.stringify(error)}` });
        } else {
            setMessage({ type: 'success', text: "Profile updated successfully." });
        }
    }

    if (loading) {
        return <Loading />;
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 text-white font-sans">
            {/* Header */}
            <div className="mb-8">
                <Link href="/dashboard" className="mb-4 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#B7FF00] hover:underline">
                    <ArrowLeft size={12} /> Return to System
                </Link>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Account Settings</h1>
                <p className="text-white/60">Manage your identity and preferences.</p>
            </div>

            <div className="space-y-6">
                {/* Identity Section */}
                <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-6">
                    <div className="mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
                        <User size={18} className="text-[#B7FF00]" />
                        <h2 className="text-sm font-bold uppercase tracking-wide text-white">Identity Credentials</h2>
                    </div>

                    <div className="space-y-6">
                        {/* Avatar Upload */}
                        <div>
                            <label className="block text-xs font-mono text-white/50 mb-3 uppercase">Profile Photo</label>
                            <div className="flex items-center gap-6">
                                <div className="relative h-20 w-20 rounded-full bg-zinc-800 overflow-hidden border border-white/10 shrink-0">
                                    {avatarUrl ? (
                                        <>
                                            <img
                                                key={avatarUrl}
                                                src={avatarUrl}
                                                alt="Avatar"
                                                className="h-full w-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = "none";
                                                    // Show fallback
                                                    const sibling = e.currentTarget.nextElementSibling;
                                                    if (sibling) sibling.classList.remove('hidden');
                                                }}
                                            />
                                            {/* Hidden fallback shown on error */}
                                            <div className="hidden absolute inset-0 flex items-center justify-center text-white/20 bg-zinc-800">
                                                <User size={32} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-white/20">
                                            <User size={32} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="avatar-upload"
                                            accept="image/png, image/jpeg, image/webp, image/gif"
                                            onChange={uploadAvatar}
                                            className="hidden"
                                            disabled={uploading}
                                        />
                                        <label
                                            htmlFor="avatar-upload"
                                            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white/5 transition"
                                        >
                                            {uploading ? 'Uploading...' : 'Upload New Photo'}
                                        </label>
                                    </div>
                                    <p className="mt-2 text-xs text-white/40">JPEGs, PNGs, WebP supported. Max file size 2MB.</p>
                                </div>
                            </div>
                        </div>

                        {/* Email (Read Only) */}
                        <div>
                            <label className="block text-xs font-mono text-white/50 mb-1.5 uppercase">System Email</label>
                            <div className="w-full rounded-lg border border-white/5 bg-zinc-900 p-3 text-sm text-white/50 cursor-not-allowed">
                                {email}
                                <span className="ml-2 text-xs text-white/30">(ID: {userId?.slice(0, 8)}...)</span>
                            </div>
                        </div>

                        {/* Username */}
                        <div>
                            <label className="block text-xs font-mono text-white/50 mb-1.5 uppercase">Public Username</label>
                            <div className="relative">
                                <input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    placeholder="username"
                                    className={`w-full rounded-lg border bg-black p-3 text-sm text-white placeholder:text-white/20 focus:outline-none transition ${usernameAvailable === false ? "border-red-500/50 focus:border-red-500" :
                                        usernameAvailable === true ? "border-[#B7FF00]/50 focus:border-[#B7FF00]" :
                                            "border-white/10 focus:border-white/30"
                                        }`}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {checkingUsername && <Loader2 size={16} className="animate-spin text-white/30" />}
                                    {!checkingUsername && username && usernameAvailable === true && <CheckCircle size={16} className="text-[#B7FF00]" />}
                                    {!checkingUsername && username && usernameAvailable === false && <XCircle size={16} className="text-red-500" />}
                                </div>
                            </div>
                            <p className="mt-1.5 text-xs text-white/40">
                                Unique identifier for community features. Lowercase letters, numbers, and underscores only.
                            </p>
                        </div>

                        {/* Full Name */}
                        <div>
                            <label className="block text-xs font-mono text-white/50 mb-1.5 uppercase">Display Name</label>
                            <input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="e.g. John Doe"
                                className="w-full rounded-lg border border-white/10 bg-black p-3 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none transition"
                            />
                        </div>
                    </div>

                    {/* Error/Success Message */}
                    {message && (
                        <div className={`mt-6 p-4 rounded-lg border text-sm ${message.type === 'success' ? 'bg-[#B7FF00]/10 border-[#B7FF00]/20 text-[#B7FF00]' : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    {/* Save Action */}
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving || (!!username && usernameAvailable === false)}
                            className="flex items-center gap-2 rounded-lg bg-[#B7FF00] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#caff33] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save Changes
                        </button>
                    </div>
                </div>

                {/* Zone Info / Billing */}
                <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-6 opacity-60 hover:opacity-100 transition">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-white/5 p-3">
                            <CreditCard size={20} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-white">Subscription & Billing</h3>
                            <p className="text-sm text-white/60">Manage your plan and payment methods.</p>
                        </div>
                        <button
                            onClick={async () => {
                                const res = await fetch("/api/stripe/portal", { method: "POST" });
                                const data = await res.json();
                                if (data?.url) window.location.href = data.url;
                            }}
                            className="rounded-lg border border-white/10 bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
                        >
                            Manage
                        </button>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
                <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-red-500/10 p-3">
                        <Shield size={20} className="text-red-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-red-500">Danger Zone</h3>
                        <p className="text-sm text-red-200/60 mt-1">
                            Irrecoverable actions. Proceed with caution.
                        </p>
                        <button
                            onClick={async () => {
                                if (confirm("Are you ABSOLUTELY sure? This will permanently delete your account, all created assets, and active subscriptions. This action cannot be undone.")) {
                                    if (confirm("Last chance: Delete your account forever?")) {
                                        try {
                                            setLoading(true);
                                            const res = await fetch("/api/user/delete-account", { method: "DELETE" });
                                            if (res.ok) {
                                                alert("Account deleted. Goodbye!");
                                                window.location.href = "/";
                                            } else {
                                                const data = await res.json();
                                                alert("Error: " + (data.error || "Failed to delete"));
                                                setLoading(false);
                                            }
                                        } catch (e) {
                                            alert("An unexpected error occurred.");
                                            setLoading(false);
                                        }
                                    }
                                }
                            }}
                            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/20 transition"
                        >
                            Delete My Data & Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
