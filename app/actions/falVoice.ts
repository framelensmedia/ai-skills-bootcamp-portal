"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

const FAL_KEY = process.env.FAL_KEY;

// Define our platform preset voices. 
// These are the predefined voices supported by ChatterboxHD text-to-speech.
const PRESET_VOICES = [
    { id: "Aurora", name: "Aurora", type: "preset", ref_audio_url: "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/voices/presets/aurora.wav" },
    { id: "Blade", name: "Blade", type: "preset", ref_audio_url: "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/voices/presets/blade.wav" },
    { id: "Britney", name: "Britney", type: "preset", ref_audio_url: "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/voices/presets/britney.wav" },
    { id: "Carl", name: "Carl", type: "preset", ref_audio_url: "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/voices/presets/carl.wav" },
    { id: "Cliff", name: "Cliff", type: "preset", ref_audio_url: "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/voices/presets/cliff.wav" },
    { id: "Richard", name: "Richard", type: "preset", ref_audio_url: "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/voices/presets/richard.wav" },
    { id: "Rico", name: "Rico", type: "preset", ref_audio_url: "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/voices/presets/rico.wav" },
    { id: "Siobhan", name: "Siobhan", type: "preset", ref_audio_url: "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/voices/presets/siobhan.wav" },
    { id: "Vicky", name: "Vicky", type: "preset", ref_audio_url: "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/voices/presets/vicky.wav" }
];

export async function generateTTS(text: string, voiceId: string, refAudioUrl: string) {
    if (!FAL_KEY) {
        throw new Error("Fal.ai API Key not configured.");
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Unauthorized");
    }

    const isPreset = PRESET_VOICES.some(v => v.id === voiceId);

    let audioUrl = "";

    try {
        if (isPreset) {
            // Preset voices use ChatterboxHD
            const endpoint = `https://fal.run/resemble-ai/chatterboxhd/text-to-speech`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Key ${FAL_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    voice: voiceId
                })
            });

            if (!response.ok) {
                const errBase = await response.text();
                throw new Error(`Fal API Error (${response.status}): ${errBase}`);
            }

            const data = await response.json();
            if (data.audio && data.audio.url) {
                audioUrl = data.audio.url;
            } else {
                throw new Error("No audio URL returned from Fal.ai (ChatterboxHD)");
            }
        } else {
            // Cloned voices use F5-TTS natively
            // refAudioUrl should be provided from the frontend fetching the cloned voice
            if (!refAudioUrl) {
                throw new Error("Reference audio URL is required for cloned voices.");
            }

            const endpoint = `https://fal.run/fal-ai/f5-tts`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Key ${FAL_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gen_text: text,
                    ref_audio_url: refAudioUrl,
                    model_type: "F5-TTS",
                    remove_silence: true
                })
            });

            if (!response.ok) {
                const errBase = await response.text();
                throw new Error(`Fal API Error (${response.status}): ${errBase}`);
            }

            const data = await response.json();
            if (data.audio_url && data.audio_url.url) {
                audioUrl = data.audio_url.url;
            } else if (data.audio && data.audio.url) {
                audioUrl = data.audio.url; // fallback just in case
            } else {
                throw new Error("No audio URL returned from Fal.ai (F5-TTS)");
            }
        }

        // Find the actual name or default to the ID. For cloned voices we need to pass a UUID but F5 accepts name
        let voiceUUID = isPreset ? null : voiceId;

        // If we want to know the "name" of the voice to show in UI
        let finalVoiceName = voiceId;
        if (!isPreset) {
            // Need to fetch custom voice name from voices table
            const { data: voiceRow } = await supabase.from('voices').select('name').eq('id', voiceId).single();
            if (voiceRow) finalVoiceName = voiceRow.name;
        }

        const { error: dbError } = await supabase
            .from('voice_generations')
            .insert({
                user_id: user.id,
                voice_id: voiceUUID, // null for presets because they aren't in the Custom Voices UUID table
                voice_name: finalVoiceName,
                text_prompt: text,
                audio_url: audioUrl
            });

        if (dbError) {
            console.error("Failed to save voice generation history:", dbError);
            // We don't throw, we still return the audio for the user.
        }

        return { success: true, audioUrl };
    } catch (error: any) {
        console.error("TTS Generation Error:", error);
        return { success: false, error: error?.message || String(error) };
    }
}

export async function getVoices() {
    // Bust Next.js aggressive cache so newly cloned voices appear immediately
    revalidatePath("/studio/creator");

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    let customVoices: any[] = [];
    if (user) {
        const { data, error } = await supabase
            .from('voices')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            customVoices = data.map(v => ({
                id: v.id,
                name: v.name,
                type: 'cloned',
                ref_audio_url: v.preview_audio_url
            }));
        }
    }

    return { success: true, voices: [...PRESET_VOICES, ...customVoices] };
}
