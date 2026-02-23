export function cleanPrompt(text: string | null | undefined): string {
    if (!text) return "";

    let cleaned = text;

    // Remove all system-level instructions (case-insensitive)
    const systemPatterns = [
        /COMPOSITION PRIORITY:[^\n]*/gi,
        /\[STRICT IDENTITY LOCK[^\]]*\]/gi,
        /\[PHOTOSHOP CUTOUT MODE\]/gi,
        /\[AUTO-OUTFIT\]:[^\n]*/gi,
        /\[CONTEXT SHIFT\]:[^\n]*/gi,
        /CRITICAL TASK:[^\n]*/gi,
        /\d+\.\s*FACE LOCK:[^\n]*/gi,
        /\d+\.\s*NO BEAUTIFICATION:[^\n]*/gi,
        /\d+\.\s*POSE & PROP MATCH:[^\n]*/gi,
        /\d+\.\s*EXPRESSION LOCK:[^\n]*/gi,
        /\d+\.\s*COMPOSITION:[^\n]*/gi,
        /\d+\.\s*BLENDING:[^\n]*/gi,
        /\d+\.\s*OUTFIT:[^\n]*/gi,
        /You are a professional retoucher[^.]*\./gi,
        /You must CUT OUT[^.]*\./gi,
        /The face in the final image MUST BE[^.]*\./gi,
        /DO NOT GENERATE A NEW FACE[^.]*\./gi,
        /DO NOT MORPH THE FACE[^.]*\./gi,
        /Keep the original skin texture[^.]*\./gi,
        /Match the lighting direction[^.]*\./gi,
        /Keep the Subject's EXACT outfit[^.]*\./gi,
        /Change the background[^.]*\./gi,
        /Discard the background from Image[^.]*\./gi,
        /Use the background[^.]*\./gi,
        /It must be a distinct[^.]*\./gi,
        /IDENTITY LOCK[^.]*\./gi,
        /PIXEL-PERFECT MATCH[^.]*\./gi,
        /EXACT POSE[^.]*\./gi,
        /Do not smooth the skin[^.]*\./gi,
        /Do not change features[^.]*\./gi,
        /preserve the EXACT facial expression[^.]*\./gi,
        /Edit the template image\./gi,
        /Change subjectLock to:[^.]*\./gi,
        /subjectLock:\s*(true|false)/gi,
        /,\s*shot on Canon 5D Mk IV, 85mm lens, f\/1\.8, sharp focus, cinematic lighting, photorealistic, hyper-realistic, 8k, master photography/ig,
        /Shot on RED Weapon 8K with Panavision Primo 70mm lens\.\s*Cinematic lighting, color graded\./ig,
        /Shot on ARRI Alexa Mini with Zeiss Master Prime 50mm\.\s*High key lighting, crisp, clean, premium advertisement look\./ig,
        /Shot on Canon 5D Mk IV with Sigma 24-70mm f\/2\.8 lens\.\s*Natural lighting, handheld feel, authentic texture\./ig,
        /3D Animation style by Pixar\.\s*Vibrant colors, expressive lighting, soft shading, cute characters\./ig,
        /\[USER INSTRUCTIONS\]:/gi,
        /\[BUSINESS BLUEPRINT CONTEXT[^\]]*\][\s\S]*?(?=\[|$)/gi,
        /\[INDUSTRY CONTEXT\]:[^\n]*/gi,
        /\[TEXT PRESERVATION\]:[^\n]*/gi,
        /\[TEXT REPLACEMENT MANDATE\]:[^\n]*/gi,
        /\[LOGO MANDATE\][^\n]*/gi,
        /LOGO CREATION:[^\n]*/gi,
        /\[AUTO-TEXT FOR INDUSTRY CHANGE\]:[^\n]*/gi,
        /\[OUTFIT ADAPTATION\]:[^\n]*/gi,
        /\[SUBJECT REPLACEMENT MODE[^\]]*\]/gi,
        /\[MULTI-SUBJECT MANDATE\]:[^\n]*/gi,
        /FACE LOCK: Each person's face must be 100% faithful to their reference image\./gi,
        /\[FACE ONLY SWAP\]:[^\n]*/gi,
        /^,\s*/g,
    ];

    // Apply all system instruction filters
    systemPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
    });

    // Extract and preserve only user-facing content
    // Look for industry context, business details, etc.
    const userContentPatterns = [
        /industry:\s*['"]?([^'".;\n]+)['"]?/gi,
        /business:\s*['"]?([^'".;\n]+)['"]?/gi,
        /headline:\s*['"]?([^'".;\n]+)['"]?/gi,
        /promotion:\s*['"]?([^'".;\n]+)['"]?/gi,
    ];

    const userDetails: string[] = [];
    userContentPatterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
            if (match[1] && match[1].trim()) {
                userDetails.push(match[1].trim());
            }
        });
    });

    // If we extracted user details, use those. Otherwise use cleaned text
    if (userDetails.length > 0) {
        return userDetails.join(' • ');
    }

    // Remove excessive whitespace and clean up
    cleaned = cleaned
        .replace(/\n{3,}/g, '\n\n') // Multiple newlines to max 2
        .replace(/\s{2,}/g, ' ')     // Multiple spaces to 1
        .trim();

    // If cleaned text is too short or empty, return generic message
    if (cleaned.length < 10) {
        return "Custom AI generation";
    }

    return cleaned;
}
