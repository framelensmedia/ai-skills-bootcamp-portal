
export interface GHLRegistrationPayload {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    tags?: string[];
    source?: string;
}

export async function sendGHLWebhook(payload: GHLRegistrationPayload) {
    const webhookUrl = process.env.GHL_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn("GHL_WEBHOOK_URL is not set. Skipping webhook.");
        return;
    }

    try {
        const body = {
            email: payload.email,
            first_name: payload.firstName,
            last_name: payload.lastName,
            phone: payload.phone,
            tags: payload.tags || ["ai-skills-new-user"],
            source: payload.source || "AI Skills Studio",
        };

        console.log("Sending GHL Webhook:", body);

        const res = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            console.error("GHL Webhook failed:", res.status, res.statusText);
        } else {
            console.log("GHL Webhook success");
        }
    } catch (error) {
        console.error("Error sending GHL webhook:", error);
    }
}

export interface AmbassadorReferralPayload {
    ambassador_id: string;
    ambassador_email: string;
    referred_user_email: string;
    referred_user_name?: string;
    type: "referral_success";
}

export async function sendAmbassadorWebhook(payload: AmbassadorReferralPayload) {
    const webhookUrl = process.env.GHL_AMBASSADOR_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn("GHL_AMBASSADOR_WEBHOOK_URL is not set. Skipping webhook.");
        return;
    }

    try {
        console.log("Sending Ambassador Webhook:", payload);

        const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            console.error("Ambassador Webhook failed:", res.status, res.statusText);
        } else {
            console.log("Ambassador Webhook success");
        }
    } catch (error) {
        console.error("Error sending Ambassador webhook:", error);
    }
}

export interface BootcampInterestPayload {
    email: string;
    firstName?: string;
    bootcampName: string;
    slug: string;
    source?: string;
}

export async function sendBootcampInterestWebhook(payload: BootcampInterestPayload) {
    const webhookUrl = process.env.GHL_BOOTCAMP_INTEREST_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn("GHL_BOOTCAMP_INTEREST_WEBHOOK_URL is not set. Skipping webhook.");
        return;
    }

    try {
        console.log("Sending Bootcamp Interest Webhook:", payload);

        const body = {
            email: payload.email,
            first_name: payload.firstName,
            event_name: payload.bootcampName,
            program_slug: payload.slug,
            source: payload.source || "Bootcamp Page",
            tags: ["bootcamp-interest", `interest-${payload.slug}`]
        };

        const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            console.error("Bootcamp Webhook failed:", res.status, res.statusText);
        } else {
            console.log("Bootcamp Webhook success");
        }
    } catch (error) {
        console.error("Error sending Bootcamp webhook:", error);
    }
}
