const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });
const falToken = process.env.FAL_KEY;
fetch('https://fal.run/fal-ai/wan/v2.2-14b/animate/move', {
    method: 'POST',
    headers: { 'Authorization': `Key ${falToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2)));
