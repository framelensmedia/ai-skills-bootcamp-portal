// Simulate exactly what NextJS does
require('dotenv').config({ path: '/Users/taloufilms/projects/AI-Skills-Bootcamp/web/.env.local' });

const envVal = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
console.log("envVal type:", typeof envVal);

try {
    const parsed = JSON.parse(envVal);
    let key = parsed.private_key;

    console.log("Parsed key length:", key.length);
    console.log("Includes literal \\n?", key.includes('\\n'));
    console.log("Includes real \n?", key.includes('\n'));

    // The previous hack was using replace(/\\\\n/g, '\\n') which replaces \\n with \\n instead of \n!
    const finalKey = key.replace(/\\n/g, '\n');

    console.log("Final key includes literal \\n?", finalKey.includes('\\n'));
    console.log("Final key includes real \n?", finalKey.includes('\n'));

    const { GoogleAuth } = require('/Users/taloufilms/projects/AI-Skills-Bootcamp/web/node_modules/google-auth-library');
    const auth = new GoogleAuth({
        credentials: { ...parsed, private_key: finalKey },
        scopes: ["https://www.googleapis.com/auth/cloud-platform"]
    });

    auth.getClient().then(() => console.log("Google Auth OK!")).catch(e => console.error("Google Auth ERR:", e.message));

} catch (e) {
    console.error("Parse failed:", e.message);
}
