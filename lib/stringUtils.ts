export function cleanPrompt(text: string | null | undefined): string {
    if (!text) return "";
    return text
        .replace(/Edit the template image\./gi, "")
        .replace(/Change subjectLock to: 'true'\./gi, "")
        .replace(/Change subjectLock to: 'false'\./gi, "")
        .replace(/subjectLock: true/gi, "")
        .replace(/subjectLock: false/gi, "")
        .trim();
}
