import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lesson_id = searchParams.get('lesson_id');

    if (!lesson_id) {
        return NextResponse.json({ error: 'Lesson ID is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    try {
        const { data, error } = await supabase
            .from('lesson_contents')
            .select('*')
            .eq('lesson_id', lesson_id)
            .order('order_index', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ contents: data });
    } catch (error: any) {
        console.error('Error fetching lesson contents:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createSupabaseServerClient();
    const json = await request.json();
    const { lesson_id, contents } = json;

    if (!lesson_id || !Array.isArray(contents)) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    console.log(`[API] POST lesson-contents for lesson: ${lesson_id}. Items: ${contents.length}`);

    try {
        // 1. Upsert current items
        const { error: upsertError } = await supabase
            .from('lesson_contents')
            .upsert(
                contents.map((item: any) => ({
                    id: item.id, // Ensure ID is present
                    lesson_id,
                    type: item.type,
                    title: item.title,
                    order_index: item.order_index,
                    content: item.content,
                    is_published: item.is_published ?? true
                })),
                { onConflict: 'id' }
            );

        if (upsertError) throw upsertError;

        // 2. Delete items not in the list (for this lesson)
        // Fetch all IDs for this lesson
        const { data: existingItems } = await supabase
            .from('lesson_contents')
            .select('id')
            .eq('lesson_id', lesson_id);

        if (existingItems) {
            const currentIds = new Set(contents.map((c: any) => c.id));
            const toDelete = existingItems
                .map((i: { id: string }) => i.id)
                .filter((id: string) => !currentIds.has(id));

            console.log(`[API] Existing Items: ${existingItems.length}, Current Payload: ${contents.length}, To Delete: ${toDelete.length}`);

            if (toDelete.length > 0) {
                console.log('[API] Deleting IDs:', toDelete);
                const { error: deleteError } = await supabase
                    .from('lesson_contents')
                    .delete()
                    .in('id', toDelete);

                if (deleteError) throw deleteError;
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error saving lesson contents:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
