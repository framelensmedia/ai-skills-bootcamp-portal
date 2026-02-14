
import { sendGHLWebhook, sendAmbassadorWebhook, sendBootcampInterestWebhook, AmbassadorReferralPayload } from "../lib/ghl";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function runTest() {
    console.log("🚀 Starting GHL Integration Test...");

    const GHL_URL = process.env.GHL_WEBHOOK_URL;
    const AMBASSADOR_URL = process.env.GHL_AMBASSADOR_WEBHOOK_URL;
    const BOOTCAMP_URL = process.env.GHL_BOOTCAMP_INTEREST_WEBHOOK_URL;

    console.log("Configuration:");
    console.log("- GHL_WEBHOOK_URL:", GHL_URL ? "✅ Set" : "❌ Missing");
    console.log("- GHL_AMBASSADOR_WEBHOOK_URL:", AMBASSADOR_URL ? "✅ Set" : "❌ Missing");
    console.log("- GHL_BOOTCAMP_INTEREST_WEBHOOK_URL:", BOOTCAMP_URL ? "✅ Set" : "❌ Missing");

    if (!GHL_URL && !AMBASSADOR_URL && !BOOTCAMP_URL) {
        console.error("❌ No webhook URLs found. Aborting test.");
        return;
    }

    // 1. New User Registration Test
    if (GHL_URL) {
        console.log("\n🧪 Testing New User Registration Webhook...");
        try {
            await sendGHLWebhook({
                email: "test.user.ghl@example.com",
                firstName: "Test",
                lastName: "User",
                source: "AI Skills Studio (Test)",
                tags: ["ai-skills-test-user"]
            });
            console.log("✅ Registration test payload sent.");
        } catch (e) {
            console.error("❌ Registration test failed:", e);
        }
    }

    // 2. Ambassador Notification Test
    if (AMBASSADOR_URL) {
        console.log("\n🧪 Testing Ambassador Notification Webhook...");
        try {
            const payload: AmbassadorReferralPayload = {
                type: "referral_success",
                ambassador_id: "test-ambassador-123",
                ambassador_email: "ambassador.test@example.com",
                referred_user_email: "referred.user@example.com",
                referred_user_name: "Referred Friend"
            };
            await sendAmbassadorWebhook(payload);
            console.log("✅ Ambassador notification payload sent.");
        } catch (e) {
            console.error("❌ Ambassador test failed:", e);
        }
    }

    // 3. Bootcamp Interest Test
    if (BOOTCAMP_URL) {
        console.log("\n🧪 Testing Bootcamp Interest Webhook...");
        try {
            await sendBootcampInterestWebhook({
                email: "interested.student@example.com",
                firstName: "Interested",
                bootcampName: "AI Video Mastery",
                slug: "ai-video-mastery",
                source: "Simulation Script"
            });
            console.log("✅ Bootcamp interest payload sent.");
        } catch (e) {
            console.error("❌ Bootcamp test failed:", e);
        }
    }

    console.log("\n🏁 Test completed.");
}

runTest();
