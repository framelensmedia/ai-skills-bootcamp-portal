import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

type TemplateJSON = {
    schema_version: string;
    type: "single_template" | "template_pack";
    template?: any;
    pack?: any;
    templates?: any[];
};

export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();

    // Check if user is staff
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (profile?.role !== "staff") {
        return NextResponse.json({ error: "Forbidden - Staff only" }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const imageFile = formData.get("image") as File;
        const jsonString = formData.get("json") as string;

        if (!imageFile || !jsonString) {
            return NextResponse.json(
                { error: "Missing image or JSON data" },
                { status: 400 }
            );
        }

        // Parse JSON
        let templateData: TemplateJSON;
        try {
            templateData = JSON.parse(jsonString);
        } catch (e) {
            return NextResponse.json(
                { error: "Invalid JSON format" },
                { status: 400 }
            );
        }

        // Validate schema
        if (!templateData.schema_version || !templateData.type) {
            return NextResponse.json(
                { error: "Invalid template JSON structure" },
                { status: 400 }
            );
        }

        const errors: string[] = [];
        const createdIds: string[] = [];
        let packId: string | null = null;

        // Handle Template Pack
        if (templateData.type === "template_pack") {
            if (!templateData.pack || !templateData.templates) {
                return NextResponse.json(
                    { error: "Template pack missing pack or templates data" },
                    { status: 400 }
                );
            }

            // Create pack record
            const { data: packData, error: packError } = await supabase
                .from("template_packs")
                .insert({
                    pack_id: templateData.pack.pack_id,
                    pack_name: templateData.pack.pack_name,
                    pack_description: templateData.pack.pack_description,
                    category: templateData.pack.category,
                    tags: templateData.pack.tags || [],
                    drop_announcement: templateData.pack.drop_announcement || null,
                })
                .select("id")
                .single();

            if (packError) {
                return NextResponse.json(
                    { error: "Failed to create template pack", details: packError.message },
                    { status: 500 }
                );
            }

            packId = packData.id;

            // Create prompts for each template in pack
            for (const template of templateData.templates) {
                try {
                    const promptData = buildPromptData(template, packId);
                    const { data: promptRecord, error: promptError } = await supabase
                        .from("prompts")
                        .insert(promptData)
                        .select("id")
                        .single();

                    if (promptError) {
                        errors.push(`Failed to create template ${template.template_id}: ${promptError.message}`);
                    } else {
                        createdIds.push(promptRecord.id);
                    }
                } catch (e: any) {
                    errors.push(`Error processing template ${template.template_id}: ${e.message}`);
                }
            }
        }
        // Handle Single Template
        else if (templateData.type === "single_template") {
            if (!templateData.template) {
                return NextResponse.json(
                    { error: "Single template missing template data" },
                    { status: 400 }
                );
            }

            try {
                const promptData = buildPromptData(templateData.template, null);
                const { data: promptRecord, error: promptError } = await supabase
                    .from("prompts")
                    .insert(promptData)
                    .select("id")
                    .single();

                if (promptError) {
                    return NextResponse.json(
                        { error: "Failed to create template", details: promptError.message },
                        { status: 500 }
                    );
                }

                createdIds.push(promptRecord.id);
            } catch (e: any) {
                return NextResponse.json(
                    { error: `Error processing template: ${e.message}` },
                    { status: 500 }
                );
            }
        } else {
            return NextResponse.json(
                { error: "Unknown template type" },
                { status: 400 }
            );
        }

        // If all failed
        if (createdIds.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Failed to create any templates",
                    errors,
                },
                { status: 500 }
            );
        }

        // Success response
        return NextResponse.json({
            success: true,
            message: `Successfully created ${createdIds.length} draft template${createdIds.length > 1 ? "s" : ""}`,
            created_count: createdIds.length,
            draft_ids: createdIds,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        console.error("Template import error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}

function buildPromptData(template: any, packId: string | null) {
    return {
        // Core fields
        title: template.template_name || "Untitled Template",
        slug: template.template_id || `template-${Date.now()}`,
        summary: template.template_description || "",
        category: template.category || "General",
        tags: template.tags || [],
        status: "draft", // Always create as draft
        is_published: false,

        // Template-specific fields
        template_id: template.template_id,
        template_name: template.template_name,
        template_description: template.template_description,
        style_mode: template.style_mode,
        edit_mode: template.edit_mode,
        aspect_ratios: template.aspect_ratios || [],
        required_elements: template.required_elements || [],
        required_visual_elements: template.required_visual_elements || [],
        editable_fields: template.editable_fields || [],
        internal_template_recipe: template.internal_template_recipe,
        template_pack_id: packId,

        // Preview image metadata
        preview_image_storage_path: template.preview_image?.storage_path,
        preview_image_alt: template.preview_image?.alt,

        // Prompt text (use internal recipe as base)
        prompt_text: template.internal_template_recipe || "",
    };
}
