
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { sendBootcampInterestWebhook } from "@/lib/ghl";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, firstName, bootcampName, slug, bootcampId } = body;

        if (!email || !slug) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Optional: Verify user session if we want to ensure "source of truth" for logged in users
        // but the form can just send what it has.
        // We might want to log this interest in Supabase 'bootcamp_interest' table if it existed,
        // but for now just webhook.

        await sendBootcampInterestWebhook({
            email,
            firstName,
            bootcampName: bootcampName || "Unknown Bootcamp",
            slug,
            source: "Bootcamp Interest Form"
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Bootcamp Notify Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
