const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Manually find and read .env
const envPath = path.resolve(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

let rawKey = null;
const lines = envContent.split('\n');
for (const line of lines) {
    if (line.startsWith('FIREBASE_PRIVATE_KEY=')) {
        rawKey = line.split('FIREBASE_PRIVATE_KEY=')[1].trim();
        break;
    }
}

if (!rawKey) {
    console.error('FIREBASE_PRIVATE_KEY not found in .env');
    process.exit(1);
}

console.log('Raw Key Length:', rawKey.length);
console.log('Raw Key Start:', rawKey.substring(0, 30));
console.log('Raw Key End:', rawKey.substring(rawKey.length - 30));

let privateKey = rawKey;
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

console.log('Parsed Key Start:', privateKey.substring(0, 30).replace(/\n/g, '\\n'));
console.log('Parsed Key End:', privateKey.substring(privateKey.length - 30).replace(/\n/g, '\\n'));

try {
    const key = crypto.createPrivateKey(privateKey);
    console.log('✅ Key is valid and parsable by Node.js crypto!');
} catch (error) {
    console.error('❌ Failed to parse private key:');
    console.error(error.message);
    // console.error(error.stack);
}
