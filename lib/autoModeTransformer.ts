/**
 * AUTO Mode Data Transformer
 * Converts structured AUTO mode answers into generation-ready prompt
 */

export interface AutoModeData {
    asset_type: string;
    project_name: string;
    copy_block: {
        headline?: string;
        subheadline?: string;
        cta?: string;
        offer?: string;
    };
    assets?: {
        subject_photo?: File;
        logo?: File;
        product?: File;
    };
    style_vibe: string;
    color_preferences?: string;
    special_instructions?: string;
}

export interface TransformedOutput {
    prompt: string;
    uploads: File[];
    metadata: AutoModeData;
}

/**
 * Transforms AUTO mode structured data into a generation prompt
 */
export function transformAutoModeToPrompt(data: AutoModeData): TransformedOutput {
    const parts: string[] = [];

    // Asset type and project
    const type = data.asset_type || "Digital Artwork";
    const projectPart = data.project_name ? ` for "${data.project_name}"` : "";
    parts.push(`Create a professional ${type.toLowerCase()}${projectPart}.`);

    // Copy/text elements
    const copyParts: string[] = [];
    if (data.copy_block?.headline) {
        copyParts.push(`Headline: "${data.copy_block.headline}"`);
    }
    if (data.copy_block?.subheadline) {
        copyParts.push(`Subheadline: "${data.copy_block.subheadline}"`);
    }
    if (data.copy_block?.cta) {
        copyParts.push(`Call-to-action: "${data.copy_block.cta}"`);
    }
    if (data.copy_block?.offer) {
        copyParts.push(`Offer/tagline: "${data.copy_block.offer}"`);
    }

    if (copyParts.length > 0) {
        parts.push("\nText elements:");
        parts.push(copyParts.join("\n"));
    }

    // Style & vibe
    const vibe = data.style_vibe || "Creative, Premium, High Quality";
    parts.push(`\nStyle: ${vibe}`);

    // Colors
    if (data.color_preferences) {
        parts.push(`Colors: ${data.color_preferences}`);
    }

    // Special instructions
    if (data.special_instructions) {
        parts.push(`\nSpecial requirements: ${data.special_instructions}`);
    }

    // Asset-specific guidance
    parts.push("\nEnsure all text is clearly legible and professionally typeset.");
    parts.push("Use modern, premium design principles.");
    parts.push("Make it visually striking and attention-grabbing.");

    // Enforce Likeness & Cutout Style if Subject is present
    if (data.assets?.subject_photo) {
        parts.push("\nCRITICAL: Maintain 100% facial likeness of the subject provided.");
        parts.push("Subject Style: Create a high-quality 'photoshop cutout' look for the subject, blending them naturally into the scene but keeping them as the focal point.");
        parts.push("Do not cartoons or caricatures. Keep the face photorealistic.");
    }

    const prompt = parts.join("\n");

    // Collect uploads
    // ORDER MATTERS: Route.ts expects FIRST = TEMPLATE, LAST = SUBJECT
    const uploads: File[] = [];
    if (data.assets?.product) uploads.push(data.assets.product); // Template / Style Ref
    if (data.assets?.logo) uploads.push(data.assets.logo);
    if (data.assets?.subject_photo) uploads.push(data.assets.subject_photo); // Subject Target

    return {
        prompt,
        uploads,
        metadata: data,
    };
}
