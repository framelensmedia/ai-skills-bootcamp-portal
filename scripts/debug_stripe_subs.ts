// @ts-ignore
require("dotenv").config({ path: ".env.local" });
const { stripe } = require("../lib/stripe-server");

async function main() {
    console.log("--- Debugging Stripe Subscriptions ---");

    try {
        // 1. Check Search API (Indexed, eventually consistent)
        console.log("\n1. Testing Search API (status:'trialing')...");
        const searchTrialing = await stripe.subscriptions.search({
            query: "status:'trialing'",
            limit: 10,
        });
        console.log("Search 'trialing' Count:", searchTrialing.total_count);
        console.log("Search Results:", JSON.stringify(searchTrialing.data, null, 2));

        console.log("\n2. Testing Search API (status:'active')...");
        const searchActive = await stripe.subscriptions.search({
            query: "status:'active'",
            limit: 10,
        });
        console.log("Search 'active' Count:", searchActive.total_count);


        // 2. Check List API (Real-time)
        console.log("\n3. Testing List API (status: 'trialing')...");
        const listTrialing = await stripe.subscriptions.list({
            status: "trialing",
            limit: 10,
        });
        console.log("List 'trialing' Length:", listTrialing.data.length);
        console.log("List Results:", JSON.stringify(listTrialing.data, null, 2));

        // 3. Check for any subscription to see raw status
        console.log("\n4. Listing ALL recent subscriptions to check raw status...");
        const allRecent = await stripe.subscriptions.list({
            limit: 5,
        });
        allRecent.data.forEach((sub: any) => {
            console.log(`ID: ${sub.id} | Status: ${sub.status} | Trial End: ${sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : 'N/A'}`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
