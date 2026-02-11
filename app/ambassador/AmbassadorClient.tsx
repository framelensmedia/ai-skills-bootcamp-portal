"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Check, Copy, DollarSign, LayoutDashboard, Share2, TrendingUp, Users, Info, Zap, BarChart2, Globe, Loader2 } from "lucide-react";

const POST_TEMPLATES = [
    {
        title: "Post #1 – Awareness",
        caption: `AI is changing business faster than most people realize.\nThe scary part is not AI itself.\nIt’s being the last person to learn how to use it.\n\nI’m spending the next 30 days getting AI-literate so I can help myself and others stay ahead.\n\nIf you’re curious, comment “AI” and I’ll share what I’m using.`
    },
    {
        title: "Post #2 – Authority",
        caption: `You do not need to be technical to use AI.\nYou need to understand how to apply it to real business problems.\n\nThat’s what I’m learning right now.\nNo coding. No hype. Just practical use.\n\nIf you own a business or want to start one, this matters more than you think.`
    },
    {
        title: "Post #3 – Opportunity",
        caption: `What if learning AI could also become an income skill?\n\nNot trading.\nNot crypto.\nNot dropshipping.\n\nJust learning how to use AI and teaching others the same thing.\n\nThat’s the direction I’m going this year`
    }
];

interface AmbassadorClientProps {
    initialUser: any;
    initialProfile: any;
    initialAmbassador: any;
    initialStats: any;
}

export default function AmbassadorClient({ initialUser, initialProfile, initialAmbassador, initialStats }: AmbassadorClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Derived Initial State
    const deriveInitialView = () => {
        if (!initialUser) return "landing";
        if (initialAmbassador) {
            return initialAmbassador.onboarding_step >= 4 ? "dashboard" : "onboarding";
        }
        return "landing";
    };

    const deriveInitialStep = () => {
        if (initialAmbassador) {
            const step = initialAmbassador.onboarding_step;
            return Math.max(1, step === 0 ? 1 : step);
        }
        return 1;
    };

    // Client-side debugging & Initial Fetch
    useEffect(() => {
        if (!initialUser) {
            console.log("No Initial User - Fetching Client Side");
            checkAuthClientSide();
        }
    }, []);

    const checkAuthClientSide = async () => {
        try {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                // Fetch Profile & Ambassador
                const [profileRes, ambassadorRes] = await Promise.all([
                    supabase.from("profiles").select("plan, staff_pro, role").eq("user_id", session.user.id).maybeSingle(),
                    supabase.from("ambassadors").select("*").eq("user_id", session.user.id).maybeSingle()
                ]);

                // Update Derived State
                const profile = profileRes.data;
                const isPro = profile?.plan === "premium" || profile?.staff_pro ||
                    ["staff", "instructor", "editor", "admin", "super_admin"].includes(profile?.role || "");

                setUserPlan(isPro ? "pro" : "free");
                setAmbassador(ambassadorRes.data);
                setUser(session.user); // Update local user state

                if (ambassadorRes.data) {
                    // If they are an existing ambassador, go to dashboard
                    // (Unless they are on step 1-3, handled by deriveInitialView logic usually)
                    const step = ambassadorRes.data.onboarding_step;
                    if (step >= 4) {
                        setView("dashboard");
                    } else {
                        setView("onboarding");
                        setViewStep(Math.max(1, step === 0 ? 1 : step));
                    }
                    // Fetch stats
                    refreshData(true);
                }
            } else {
                console.log("No Session Found");
            }
        } catch (e) {
            console.error("Auth Check Failed", e);
        }
    };

    const [loading, setLoading] = useState(false); // Only used for client-side actions now
    const [error, setError] = useState("");
    const [view, setView] = useState<"landing" | "onboarding" | "dashboard" | "details">(deriveInitialView());
    const [previousView, setPreviousView] = useState<"landing" | "onboarding" | "dashboard">("landing");

    // Determine Plan based on profile prop
    const isPro = initialProfile?.plan === "premium" || initialProfile?.staff_pro ||
        ["staff", "instructor", "editor", "admin", "super_admin"].includes(initialProfile?.role || "");
    const [userPlan, setUserPlan] = useState<"free" | "pro" | null>(initialUser ? (isPro ? "pro" : "free") : null);

    // Ambassador Data
    const [ambassador, setAmbassador] = useState<any>(initialAmbassador);
    const [stats, setStats] = useState<any>(initialStats);
    const [user, setUser] = useState<any>(initialUser); // Local user state for client-side auth

    const [viewStep, setViewStep] = useState(deriveInitialStep());

    // Inputs
    const [postLinks, setPostLinks] = useState(["", "", ""]);
    const [verifying, setVerifying] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Check query params for Stripe Return
    useEffect(() => {
        if (searchParams.get("connected") === "true") {
            console.log("Stripe Connected Param Detected - Refreshing Data");
            refreshData();
        }
    }, [searchParams]);

    const refreshData = async (silent = false) => {
        console.log("refreshData called");
        if (!silent) setLoading(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) return;

            const res = await fetch("/api/ambassador/stats", {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setAmbassador(data.ambassador);
                setStats(data.stats);

                // Update view if needed (e.g. just finished Stripe connect)
                if (view === 'onboarding' && data.ambassador.onboarding_step >= 4) {
                    setView("dashboard");
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        if (!user) return router.push("/login?next=/ambassador");

        setLoading(true);
        setError("");
        try {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch("/api/ambassador/apply", {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data = await res.json();

            if (!res.ok) {
                if (data.code === "requires_pro") {
                    setError("You must be a Pro Member to apply.");
                } else {
                    setError(data.error || "Failed to apply");
                }
                setLoading(false);
                return;
            }

            // Success -> Move to Onboarding
            setAmbassador(data.ambassador);
            setView("onboarding");
            setViewStep(1);
        } catch (e) {
            setError("Something went wrong.");
            setLoading(false);
        }
    };

    const submitPosts = async () => {
        const validLinks = postLinks.filter(l => l.length > 5);
        if (validLinks.length < 3) {
            setError("Please provide 3 valid links.");
            return;
        }

        setVerifying(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();

            const res = await fetch("/api/ambassador/verify-posts", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ links: validLinks })
            });

            if (res.ok) {
                refreshData();
                setViewStep(2); // Auto advance view
            } else {
                setError("Failed to verify posts.");
            }
        } catch (e) {
            setError("Error submitting posts.");
        } finally {
            setVerifying(false);
        }
    };

    const handleStripeConnect = async () => {
        setLoading(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();

            const res = await fetch("/api/stripe/connect", {
                method: "POST",
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            const data = await res.json();

            if (data.url) {
                window.location.href = data.url; // Redirect to Stripe
            } else {
                setError("Failed to start Stripe connection.");
                setLoading(false);
            }
        } catch (e) {
            setError("Connection failed.");
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure? Use this only if you connected the WRONG Stripe account.\n\nThis will disconnect your current payout method and require you to connect a new one.")) return;

        setLoading(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();

            const res = await fetch("/api/stripe/disconnect", {
                method: "POST",
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });

            if (res.ok) {
                window.location.reload(); // Refresh to reset state
            } else {
                alert("Failed to disconnect.");
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const debugSkip = async () => {
        setLoading(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();
            await fetch("/api/ambassador/debug-advance", {
                method: "POST",
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            await refreshData();
            // Optimistically advance view step
            if (viewStep < 3) setViewStep(viewStep + 1);
        } catch (e) {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleTrainingComplete = async () => {
        setLoading(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();
            await fetch("/api/ambassador/complete-training", {
                method: "POST",
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            await refreshData();
            // Advance to Step 3
            setViewStep(3);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Removed blocking spinner to ensure HTML loads instantly
    // if (loading) return (...)

    // --- VIEW: PROGRAM DETAILS (READ ONLY) ---
    if (view === "details") {
        return (
            <div className="min-h-screen bg-black text-white p-6 md:p-12 relative">
                <button onClick={() => setView(previousView)} className="absolute top-6 left-6 text-gray-400 hover:text-white flex items-center gap-2">
                    ← Back to {previousView === 'dashboard' ? 'Dashboard' : 'Onboarding'}
                </button>
                <div className="max-w-4xl mx-auto pt-10">
                    <h1 className="text-4xl font-bold mb-8">Ambassador Program Details</h1>

                    <div className="space-y-8 text-gray-300">
                        <section>
                            <h3 className="text-xl font-bold text-white mb-2">How it works</h3>
                            <p>You earn recurring commissions by referring new Pro members to AI Skills Studio. As an Ambassador, you are a partner in our mission to teach AI literacy.</p>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
                            <div className="bg-[#111] p-6 rounded-xl border border-gray-800">
                                <h4 className="font-bold text-white mb-1">Commission Structure</h4>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    <li><span className="text-green-400 font-bold">$10.00 / month</span> recurring for every active Pro member.</li>
                                    <li><span className="text-green-400 font-bold">$0.50</span> one-time bonus for every $1 Trial signup.</li>
                                </ul>
                            </div>
                            <div className="bg-[#111] p-6 rounded-xl border border-gray-800">
                                <h4 className="font-bold text-white mb-1">Payout Schedule</h4>
                                <p className="text-sm">We use Stripe Connect for instant payouts. Funds are transferred to your connected bank account immediately upon successful payment by the referred user (minus Stripe processing times).</p>
                            </div>
                        </div>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-2">Rules & Guidelines</h3>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Do not spam. Focus on educational content and genuine recommendations.</li>
                                <li>You cannot refer yourself.</li>
                                <li>We reserve the right to ban ambassadors who engage in misleading marketing or harassment.</li>
                            </ul>

                            <div className="mt-8 pt-6 border-t border-gray-800">
                                <a href="/terms/ambassador" className="text-sm text-purple-400 hover:text-purple-300 underline">
                                    Read Full Terms & Conditions
                                </a>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        )
    }

    // --- VIEW: DASHBOARD ---
    if (view === "dashboard" && ambassador) {
        const refLink = `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${ambassador.referral_code}`;

        return (
            <div className="min-h-screen bg-black text-white p-6 md:p-12">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Ambassador Dashboard</h1>
                            <p className="text-gray-400">Welcome back! Here's how your impact is growing.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 justify-start md:justify-end mt-4 md:mt-0">
                            <button onClick={handleDisconnect} className="text-red-500 hover:text-red-400 text-xs underline px-2 whitespace-nowrap order-3 md:order-1 w-full md:w-auto text-left md:text-center mt-2 md:mt-0">
                                Disconnect
                            </button>
                            <button onClick={() => { setPreviousView("dashboard"); setView("details"); }} className="bg-transparent border border-gray-800 hover:bg-gray-900 text-gray-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap order-1 md:order-2 flex-1 md:flex-none justify-center">
                                <Info size={16} /> Program Info
                            </button>
                            <button onClick={() => window.open("https://dashboard.stripe.com/login", "_blank")} className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap order-2 md:order-3 flex-1 md:flex-none text-center">
                                View Stripe Payouts
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-green-500/10 text-green-400 rounded-lg"><DollarSign size={20} /></div>
                                <span className="text-gray-400 text-sm font-medium">Monthly Earnings</span>
                            </div>
                            <div className="text-3xl font-bold">${((stats?.active_pro_members || 0) * 10).toFixed(2)}</div>
                            <div className="text-xs text-gray-500 mt-1">Recurring Revenue</div>
                        </div>

                        <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><TrendingUp size={20} /></div>
                                <span className="text-gray-400 text-sm font-medium">Pending Payout</span>
                            </div>
                            <div className="text-3xl font-bold">${stats?.pending_usd?.toFixed(2) || "0.00"}</div>
                            <div className="text-xs text-gray-500 mt-1">Arriving via Stripe Connect</div>
                        </div>

                        <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><Users size={20} /></div>
                                <span className="text-gray-400 text-sm font-medium">Active Members</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <div className="text-3xl font-bold">{stats?.active_pro_members || 0}</div>
                                <span className="text-sm text-gray-500">Pro</span>
                                <div className="text-3xl font-bold ml-2">{stats?.active_trials || 0}</div>
                                <span className="text-sm text-gray-500">Trials</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Earn $10/mo (Pro) + $0.50 (Trial)
                            </div>
                        </div>
                    </div>

                    {/* Referral Link */}
                    <div className="bg-[#111] border border-gray-800 p-8 rounded-2xl">
                        <h3 className="text-lg font-semibold mb-4 text-white">Your Referral Link</h3>
                        <div className="flex gap-2">
                            <input readOnly value={refLink} className="flex-1 bg-black border border-gray-700 rounded-lg px-4 py-3 text-gray-300 font-mono text-sm focus:outline-none focus:border-purple-500" />
                            <button onClick={() => navigator.clipboard.writeText(refLink)} className="bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2">
                                <Copy size={18} /> Copy
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mt-3">
                            Share this link anywhere. You earn <b>$0.50</b> for every trial + <b>$10/mo</b> for every active Pro member.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW: ONBOARDING ---
    if (view === "onboarding" && ambassador) {
        // 'completedStep' is the milestone they've reached.
        // e.g. onboarding_step = 1 (posts done) -> they are on step 2.
        // If onboarding_step = 0 -> they are on step 1.
        // Let's normalize: current actual step is onboarding_step + 1 (unless 0 then 1?)

        // Wait, the backend logic seems to be:
        // 0 = fresh
        // 1 = posts verified (so ready for step 2)
        // 2 = training done (ready for step 3)
        // 3 = connected (ready for dashboard)

        // So 'max reachable step' is onboarding_step + 1.
        const maxReachable = (ambassador.onboarding_step || 0) + 1;

        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-start pt-20">
                <div className="max-w-2xl w-full">
                    <div className="flex justify-between items-center mb-2">
                        <h1 className="text-3xl font-bold text-center flex-1">Let's get you set up 🚀</h1>
                    </div>

                    <p className="text-gray-400 text-center mb-10">Complete these steps to unlock your dashboard.</p>

                    {/* Stepper */}
                    <div className="flex justify-between mb-12 relative">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-800 -z-10"></div>
                        {[1, 2, 3].map((s) => {
                            const isCompleted = s < maxReachable;
                            const isCurrent = s === viewStep;
                            const isLocked = s > maxReachable;

                            return (
                                <button
                                    key={s}
                                    disabled={isLocked}
                                    onClick={() => setViewStep(s)}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2
                                    ${isCompleted ? "bg-purple-600 border-purple-600 text-white" : ""}
                                    ${isCurrent ? "bg-white border-white text-black scale-110 shadow-[0_0_15px_rgba(255,255,255,0.4)]" : ""}
                                    ${!isCompleted && !isCurrent ? "bg-black border-gray-700 text-gray-500" : ""}
                                    ${!isLocked ? "cursor-pointer hover:border-purple-400" : "cursor-not-allowed opacity-50"}
                                    `}
                                >
                                    {isCompleted && !isCurrent ? <Check size={16} /> : s}
                                </button>
                            )
                        })}
                    </div>

                    {/* Step Content */}
                    <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 md:p-8">
                        {viewStep === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-bold">Step 1: Share 3 Social Posts</h2>
                                <p className="text-gray-400">
                                    To become an ambassador, you must prove you can generate attention.
                                    Copy one of these templates, post it, and paste the link below.
                                </p>

                                <div className="space-y-6">
                                    {POST_TEMPLATES.map((template, i) => (
                                        <div key={i} className="bg-black/50 p-4 rounded-xl border border-gray-800">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-bold text-sm text-gray-300">{template.title}</span>
                                                <button onClick={() => copyToClipboard(template.caption, i)} className="text-xs bg-[#222] hover:bg-[#333] px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                                    {copiedIndex === i ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                                    {copiedIndex === i ? "Copied" : "Copy Text"}
                                                </button>
                                            </div>
                                            <div className="text-xs text-gray-500 font-mono bg-black p-3 rounded-lg mb-3 whitespace-pre-wrap max-h-24 overflow-y-auto border border-gray-900">
                                                {template.caption}
                                            </div>
                                            <input
                                                placeholder={`Paste link to your "${template.title.split('–')[1].trim()}" post...`}
                                                value={postLinks[i]}
                                                onChange={(e) => {
                                                    const newLinks = [...postLinks];
                                                    newLinks[i] = e.target.value;
                                                    setPostLinks(newLinks);
                                                }}
                                                className="w-full bg-[#111] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={submitPosts}
                                    disabled={verifying || postLinks.some(l => l.length < 5)}
                                    className="w-full bg-white text-black py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {verifying ? "Verifying..." : "Verify Posts & Continue"}
                                </button>
                                <button onClick={debugSkip} className="text-xs text-gray-600 hover:text-gray-400 w-full text-center py-2">
                                    [Admin] Skip Step
                                </button>
                            </div>
                        )}

                        {viewStep === 2 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-bold">Step 2: Ambassador Training</h2>
                                <p className="text-gray-400">Watch this short video to understand how to succeed as an ambassador.</p>

                                <div className="aspect-video bg-black rounded-lg flex items-center justify-center border border-gray-800 mb-4">
                                    <span className="text-gray-500">[ Video Placeholder: How To Promote ]</span>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button onClick={handleTrainingComplete} className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-bold transition-colors">
                                        I Watched It - Next Step
                                    </button>
                                    <button onClick={debugSkip} className="text-xs text-gray-600 hover:text-gray-400 py-2">
                                        [Admin] Skip Step
                                    </button>
                                </div>
                            </div>
                        )}

                        {viewStep === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-bold">Step 3: Connect Payouts</h2>
                                <p className="text-gray-400">Link your waiting Stripe account so we can send you instant payouts.</p>

                                <button
                                    onClick={handleStripeConnect}
                                    disabled={loading}
                                    className="w-full bg-[#635BFF] hover:bg-[#534be0] py-4 rounded-lg font-bold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Connecting...
                                        </>
                                    ) : (
                                        "Connect with Stripe"
                                    )}
                                </button>
                                <p className="text-xs text-center text-gray-500">You will be redirected to Stripe to verify your identity.</p>
                                <button onClick={debugSkip} className="text-xs text-gray-600 hover:text-gray-400 py-2 w-full text-center">
                                    [Admin] Skip Step (Force Dashboard)
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 text-center">
                        <button onClick={() => { setPreviousView("onboarding"); setView("landing"); }} className="text-gray-500 hover:text-gray-300 text-sm underline">
                            Review Program Details / Commission Rates
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW: LANDING ---
    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-4xl mx-auto px-6 py-20 text-center relative">
                {previousView === "onboarding" && (
                    <button onClick={() => setView("onboarding")} className="absolute top-6 left-6 text-gray-400 hover:text-white flex items-center gap-2">
                        ← Back to Setup
                    </button>
                )}
                <span className="inline-block px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-xs font-bold tracking-wider mb-6">AMBASSADOR PROGRAM</span>
                <h1 className="text-5xl md:text-6xl font-extrabold mb-8 tracking-tight">
                    Turn your AI Skills into <br />
                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Recurring Income.</span>
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                    Teach your community how to use AI and earn <strong className="text-white">$10/mo</strong> for every active member you refer. No limits. Instant&nbsp;payouts.
                </p>

                {/* CTA Section - Different for free users */}
                {userPlan === "free" ? (
                    <div className="max-w-xl mx-auto mb-20">
                        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-8 mb-6">
                            <div className="text-yellow-400 text-sm font-bold mb-2">⚡ PRO MEMBERSHIP REQUIRED</div>
                            <p className="text-gray-300 mb-6">Upgrade to Pro to unlock the Ambassador Program and start earning $10/mo for every member you refer.</p>
                            <a href="/pricing" className="block w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-full font-bold text-lg text-center hover:opacity-90 transition-opacity">
                                <DollarSign size={20} className="inline mr-2" />Upgrade to Pro & Start Earning
                            </a>
                        </div>
                        <button onClick={() => document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-gray-500 hover:text-gray-300 text-sm underline">
                            Read Full Program Details
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row gap-4 justify-center mb-20">
                        <button onClick={handleApply} className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform">
                            Start Earning Today
                        </button>
                    </div>
                )}

                {error && <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg mb-8 max-w-md mx-auto">{error}</div>}

                {/* Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                    <div className="bg-[#111] p-6 rounded-2xl border border-gray-800 hover:border-purple-500/30 transition-colors group">
                        <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4 text-purple-400 group-hover:scale-110 transition-transform"><DollarSign /></div>
                        <h3 className="font-bold text-lg mb-2">High Commissions</h3>
                        <p className="text-gray-400 text-sm">Earn $10/mo recurring per user + $0.50 per trial. 100 users = $1,000/mo.</p>
                    </div>
                    <div className="bg-[#111] p-6 rounded-2xl border border-gray-800 hover:border-blue-500/30 transition-colors group">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform"><Zap /></div>
                        <h3 className="font-bold text-lg mb-2">Instant Payouts</h3>
                        <p className="text-gray-400 text-sm">Paid directly to your bank account via Stripe Connect. No NET-30 waiting periods.</p>
                    </div>
                    <div className="bg-[#111] p-6 rounded-2xl border border-gray-800 hover:border-pink-500/30 transition-colors group">
                        <div className="w-12 h-12 bg-pink-500/10 rounded-xl flex items-center justify-center mb-4 text-pink-400 group-hover:scale-110 transition-transform"><BarChart2 /></div>
                        <h3 className="font-bold text-lg mb-2">Partner Dashboard</h3>
                        <p className="text-gray-400 text-sm">Track clicks, conversions, and income in real-time with comprehensive tools.</p>
                    </div>
                </div>

                <div id="details-section" className="mt-24 pt-24 border-t border-gray-900 text-left max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold mb-8 text-center">Program Details</h2>

                    {/* Video */}
                    <div className="aspect-video bg-[#111] rounded-2xl border border-gray-800 flex items-center justify-center mb-16 overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                        <div className="text-center z-10">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform cursor-pointer">
                                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent ml-1"></div>
                            </div>
                            <span className="text-gray-400 font-medium">Watch: How the Pro Ambassador Program Works</span>
                        </div>
                    </div>

                    <div className="space-y-12 text-gray-300">
                        <section>
                            <h3 className="text-xl font-bold text-white mb-4">How it works</h3>
                            <p className="leading-relaxed text-gray-400">You earn recurring commissions by referring new Pro members to AI Skills Studio. As an Ambassador, you are a partner in our mission to teach AI literacy.</p>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="font-bold text-white mb-4 text-lg">Commission Structure</h4>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3">
                                        <Check className="text-green-500 mt-1 shrink-0" size={18} />
                                        <span><span className="text-green-400 font-bold">$10.00 / month</span> recurring <br /><span className="text-xs text-gray-500">for every active Pro member</span></span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <Check className="text-green-500 mt-1 shrink-0" size={18} />
                                        <span><span className="text-green-400 font-bold">$0.50</span> one-time bonus <br /><span className="text-xs text-gray-500">for every $1 Trial signup</span></span>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-4 text-lg">Payout Schedule</h4>
                                <p className="text-sm text-gray-400 leading-relaxed mb-4">We use Stripe Connect for instant payouts. Funds are transferred to your connected bank account immediately upon successful payment by the referred user.</p>
                                <div className="flex items-center gap-2 text-xs text-purple-400">
                                    <Info size={14} /> <span>No minimum payout threshold.</span>
                                </div>
                            </div>
                        </div>

                        <section className="bg-gray-900/30 p-8 rounded-2xl border border-gray-800">
                            <h3 className="text-xl font-bold text-white mb-4">Rules & Guidelines</h3>
                            <ul className="list-disc pl-5 space-y-2 text-gray-400">
                                <li>Do not spam. Focus on educational content and genuine recommendations.</li>
                                <li>You cannot refer yourself.</li>
                                <li>We reserve the right to ban ambassadors who engage in misleading marketing or harassment.</li>
                            </ul>

                            <div className="mt-8 pt-6 border-t border-gray-800">
                                <a href="/terms/ambassador" className="text-sm text-purple-400 hover:text-purple-300 underline">
                                    Read Full Terms & Conditions
                                </a>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
