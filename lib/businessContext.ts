
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetches the Business Blueprint context for a given user.
 * This context should be injected into LLM prompts to ensure brand alignment.
 */
export async function getBusinessContext(userId: string, supabase: SupabaseClient): Promise<string | null> {
    try {
        const { data, error } = await supabase.rpc("get_blueprint_context", {
            p_user_id: userId
        });

        if (error) {
            console.warn("Error fetching business context:", error.message);
            return null;
        }

        if (!data || typeof data !== "string" || data.includes("No business blueprint found")) {
            return null;
        }

        return data;
    } catch (e) {
        console.warn("Exception fetching business context:", e);
        return null;
    }
}
