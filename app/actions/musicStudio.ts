"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

export async function getMusicGenerations() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
        .from('music_generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching music generations:", error);
        return { success: false, error: error.message };
    }

    return { success: true, generations: data || [] };
}

export async function deleteMusicGeneration(id: string) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Unauthorized" };
    }

    // Grab the generation to get the audio_url so we can delete the file
    const { data: gen, error: fetchErr } = await supabase
        .from('music_generations')
        .select('audio_url')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (fetchErr || !gen) {
        return { success: false, error: "Item not found or unauthorized" };
    }

    // Delete DB record
    const { error: dbErr } = await supabase
        .from('music_generations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (dbErr) {
        return { success: false, error: dbErr.message };
    }

    // Delete from storage bucket
    if (gen.audio_url) {
        try {
            const urlParts = gen.audio_url.split('/');
            const filename = urlParts[urlParts.length - 1];
            const filePath = `${user.id}/${filename}`;

            await supabase.storage.from('music').remove([filePath]);
        } catch (e) {
            console.error("Failed to delete music file from storage:", e);
        }
    }

    revalidatePath("/studio/creator");

    return { success: true };
}
