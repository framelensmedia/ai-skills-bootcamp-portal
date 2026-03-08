"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function getVoiceGenerations() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, generations: [] };

    const { data, error } = await supabase
        .from('voice_generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Error fetching generations:", error);
        return { success: false, error: error.message };
    }

    return { success: true, generations: data };
}

export async function deleteVoiceGeneration(id: string) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const { error } = await supabase
        .from('voice_generations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}
