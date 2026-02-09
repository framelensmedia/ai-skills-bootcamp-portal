/**
 * Auto-Recharge Helper
 * Checks if auto-recharge should be triggered and calls the auto-charge API
 */

interface AutoRechargeCheckParams {
    userId: string;
    newBalance: number;
    autoRechargeEnabled: boolean;
    autoRechargePackId: string | null;
    autoRechargeThreshold: number;
}

export async function triggerAutoRechargeIfNeeded(params: AutoRechargeCheckParams): Promise<{
    triggered: boolean;
    success?: boolean;
    creditsAdded?: number;
    newBalance?: number;
    error?: string;
}> {
    const { userId, newBalance, autoRechargeEnabled, autoRechargePackId, autoRechargeThreshold } = params;

    // Check if auto-recharge should be triggered
    if (!autoRechargeEnabled || !autoRechargePackId) {
        return { triggered: false };
    }

    if (newBalance > autoRechargeThreshold) {
        return { triggered: false };
    }

    console.log(`[Auto-Recharge] Triggered for user ${userId}. Balance: ${newBalance}, Threshold: ${autoRechargeThreshold}`);

    try {
        // Get the base URL for internal API call
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

        const res = await fetch(`${baseUrl}/api/stripe/auto-charge`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Use first 32 chars of service role key as simple internal auth
                "x-internal-secret": process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32) || "",
            },
            body: JSON.stringify({
                userId,
                packId: autoRechargePackId,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error("[Auto-Recharge] Failed:", data.error);
            return { triggered: true, success: false, error: data.error };
        }

        console.log(`[Auto-Recharge] ✅ Success! Added ${data.creditsAdded} credits. New balance: ${data.newBalance}`);
        return {
            triggered: true,
            success: true,
            creditsAdded: data.creditsAdded,
            newBalance: data.newBalance,
        };

    } catch (err: any) {
        console.error("[Auto-Recharge] Error:", err);
        return { triggered: true, success: false, error: err.message };
    }
}
