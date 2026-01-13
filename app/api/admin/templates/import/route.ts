import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();

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

    if (!profile || !["staff", "admin", "super_admin", "editor"].includes(profile.role)) {
        return NextResponse.json({ error: "Forbidden - Staff only" }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const jsonString = formData.get("json") as string;

        if (!jsonString) {
            return NextResponse.json(
                { error: "Missing JSON data" },
                { status: 400 }
            );
        }

        let templateData: any;
        try {
            templateData = JSON.parse(jsonString);
        } catch (e) {
            return NextResponse.json(
                { error: "Invalid JSON format" },
                { status: 400 }
            );
        }

        const errors: string[] = [];
        const createdIds: string[] = [];
        let packId: string | null = null;

        const uploadImage = async (file: File, folder: string, filename: string) => {
            const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
            const path = `${folder}/${safeName}`;

            console.log(`Attempting to upload: ${filename} to path: ${path}`);

            const { error: uploadError } = await supabase.storage
                .from("bootcamp-assets")
                .upload(path, file, { upsert: true });

            if (uploadError) {
                console.error(`Upload failed for ${filename}:`, uploadError);
                throw new Error(`Upload failed for ${filename}: ${uploadError.message}`);
            }

            console.log(`✅ Successfully uploaded: ${filename} to ${path}`);

            const { data: { publicUrl } } = supabase.storage
                .from("bootcamp-assets")
                .getPublicUrl(path);

            console.log(`Public URL: ${publicUrl}`);

            return { path, publicUrl };
        };

        if (templateData.type === "template_pack") {
            const pack = templateData.pack;
            const templates = templateData.templates;

            if (!pack || !templates || !Array.isArray(templates)) {
                return NextResponse.json({ error: "Invalid pack structure" }, { status: 400 });
            }

            // Build pack insert matching ACTUAL database schema
            let basePackId = pack.pack_id || pack.slug;
            const packInsert: any = {
                pack_id: basePackId,
                pack_name: pack.pack_name || pack.title,
                pack_description: pack.pack_description || pack.summary,
                category: pack.category,
                tags: Array.isArray(pack.tags) ? pack.tags : [],
                access_level: pack.access_level || "free",
                is_published: false
            };

            if (pack.drop_announcement) {
                packInsert.drop_announcement = pack.drop_announcement;
            }

            // Check if pack already exists
            const { data: existingPack } = await supabase
                .from("template_packs")
                .select("id, pack_id")
                .eq("pack_id", basePackId)
                .maybeSingle();

            let packRecord;

            if (existingPack) {
                // Pack exists - create new version with timestamp
                const timestamp = Date.now();
                packInsert.pack_id = `${basePackId}-${timestamp}`;
                console.log(`Pack ${basePackId} exists. Creating as: ${packInsert.pack_id}`);
            }

            // Handle pack thumbnail upload
            const uploadedFiles = formData.getAll("files") as File[];
            const packThumbFilename = pack.thumbnail_filename || pack.thumbnail || "pack_thumb.png";
            const packThumbFile = uploadedFiles.find(f => {
                const basename = f.name.split('/').pop() || f.name;
                return basename === packThumbFilename;
            });

            if (packThumbFile) {
                try {
                    const { publicUrl } = await uploadImage(
                        packThumbFile,
                        `packs/${packInsert.pack_id}`,
                        packThumbFile.name
                    );
                    packInsert.thumbnail_url = publicUrl;
                    console.log(`✅ Pack thumbnail uploaded: ${publicUrl}`);
                } catch (e: any) {
                    console.error("Pack thumbnail upload failed:", e.message);
                    errors.push(`Pack thumbnail upload failed: ${e.message}`);
                }
            } else {
                console.log(`⚠️  Pack thumbnail not found: ${packThumbFilename}`);
            }

            console.log("Creating pack with:", JSON.stringify(packInsert, null, 2));

            const { data: newPackRecord, error: packError } = await supabase
                .from("template_packs")
                .insert(packInsert)
                .select("id")
                .single();

            if (packError) {
                console.error("Pack creation error:", packError);
                return NextResponse.json(
                    {
                        error: "Failed to create pack",
                        details: packError.message,
                        hint: packError.hint,
                        code: packError.code
                    },
                    { status: 500 }
                );
            }

            packId = newPackRecord.id;

            // File map already has uploadedFiles from pack thumbnail handling above
            const fileMap = new Map<string, File>();

            // Map files by basename only (strip folder paths if present)
            uploadedFiles.forEach(f => {
                const basename = f.name.split('/').pop() || f.name;
                fileMap.set(basename, f);
                console.log(`Uploaded file: "${f.name}" -> mapped as: "${basename}"`);
            });

            console.log(`Total files uploaded: ${uploadedFiles.length}`);
            console.log(`File map keys:`, Array.from(fileMap.keys()));

            let sortIndex = 0;
            for (const tpl of templates) {
                try {
                    const imageFilename = tpl.featured_image || tpl.featured_image_file;
                    const templateTitle = tpl.template_name || tpl.title;
                    let templateSlug = tpl.template_id || tpl.slug;
                    const templateDesc = tpl.template_description || tpl.summary;

                    // Check if slug already exists
                    const { data: existingSlug } = await supabase
                        .from("prompts")
                        .select("slug")
                        .eq("slug", templateSlug)
                        .maybeSingle();

                    if (existingSlug) {
                        const timestamp = Date.now();
                        const originalSlug = templateSlug;
                        templateSlug = `${templateSlug}-${timestamp}`;
                        console.log(`Template slug ${originalSlug} exists. Creating as: ${templateSlug}`);
                    }

                    const file = fileMap.get(imageFilename);

                    let storagePath = null;
                    let publicUrl = null;

                    if (file) {
                        const res = await uploadImage(file, `templates/${templateSlug}`, file.name);
                        storagePath = res.path;
                        publicUrl = res.publicUrl;
                    } else {
                        errors.push(`Image not found: ${templateTitle} (Expected: ${imageFilename})`);
                    }

                    const { data: promptRecord, error: promptError } = await supabase
                        .from("prompts")
                        .insert({
                            title: templateTitle,
                            slug: templateSlug,
                            summary: templateDesc,
                            template_id: templateSlug,
                            prompt_text: tpl.prompt_text || "",
                            category: pack.category,
                            tags: tpl.tags || pack.tags || [],
                            status: "draft",
                            is_published: false,
                            pack_only: tpl.pack_only !== undefined ? tpl.pack_only : true,
                            template_pack_id: packId,
                            pack_order_index: sortIndex,
                            preview_image_storage_path: storagePath,
                            featured_image_url: publicUrl,
                            editable_fields: tpl.editable_fields || [],
                            internal_template_recipe: tpl.internal_template_recipe || tpl.prompt_text || "",
                            required_elements: tpl.required_elements || [],
                            aspect_ratios: tpl.aspect_ratios || [],
                            style_mode: tpl.style_mode,
                            edit_mode: tpl.edit_mode
                        })
                        .select("id")
                        .single();

                    if (promptError) throw promptError;

                    const { error: itemError } = await supabase
                        .from("template_pack_items")
                        .insert({
                            pack_id: packId,
                            template_id: promptRecord.id,
                            sort_index: sortIndex++
                        });

                    if (itemError) errors.push(`Failed to link template ${templateSlug}: ${itemError.message}`);
                    else createdIds.push(promptRecord.id);

                } catch (e: any) {
                    errors.push(`Error creating template ${tpl.template_name || tpl.title}: ${e.message}`);
                }
            }
        }
        else if (templateData.type === "single_template") {
            const tpl = templateData.template;
            const imageFile = formData.get("image") as File;

            let storagePath = null;
            if (imageFile) {
                const res = await uploadImage(imageFile, `templates/${tpl.template_id || 'untitled'}`, imageFile.name);
                storagePath = res.path;
            }

            const { data: promptRecord, error: promptError } = await supabase
                .from("prompts")
                .insert({
                    title: tpl.template_name,
                    slug: tpl.template_id,
                    summary: tpl.template_description,
                    template_id: tpl.template_id,
                    prompt_text: tpl.internal_template_recipe || "",
                    preview_image_storage_path: storagePath,
                    status: 'draft',
                    is_published: false,
                    editable_fields: tpl.editable_fields || [],
                    internal_template_recipe: tpl.internal_template_recipe || "",
                    style_mode: tpl.style_mode,
                    edit_mode: tpl.edit_mode,
                    category: tpl.category || "General",
                    tags: tpl.tags || [],
                    required_elements: tpl.required_elements || [],
                    required_visual_elements: tpl.required_visual_elements || [],
                })
                .select("id")
                .single();

            if (promptError) {
                return NextResponse.json({ error: promptError.message }, { status: 500 });
            }
            createdIds.push(promptRecord.id);
        } else {
            return NextResponse.json({ error: "Unknown type" }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            created_count: createdIds.length,
            pack_id: packId,
            errors: errors.length > 0 ? errors : undefined,
            message: `Successfully processed ${createdIds.length} items.`
        });

    } catch (error: any) {
        console.error("Import error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
