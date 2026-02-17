
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' }); // Load env vars

async function checkWebhooks() {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('Error: STRIPE_SECRET_KEY not found in environment.');
        process.exit(1);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-10-28.acacia' as any,
    });

    try {
        const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });

        console.log('\n--- Stripe Webhook Endpoints ---');
        if (webhooks.data.length === 0) {
            console.log('No webhook endpoints found!');
        } else {
            webhooks.data.forEach((hook) => {
                console.log(`\nID: ${hook.id}`);
                console.log(`URL: ${hook.url}`);
                console.log(`Status: ${hook.status}`);
                console.log(`Events: ${hook.enabled_events.includes('*') ? 'ALL' : hook.enabled_events.slice(0, 5).join(', ') + '...'}`);

                // Validation check
                if (hook.url.includes('aiskills.studio')) {
                    console.log('✅ Matches expected domain (presumably)');
                } else if (hook.url.includes('localhost')) {
                    console.log('⚠️ Localhost endpoint (Dev only)');
                } else {
                    console.log('❓ Unknown domain - Please Verify!');
                }
            });
        }
        console.log('\n--------------------------------');
    } catch (error) {
        console.error('Error fetching webhooks:', error);
    }
}

checkWebhooks();
