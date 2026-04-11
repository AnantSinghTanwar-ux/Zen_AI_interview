const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
let content = fs.readFileSync(envPath, 'utf8');

// The body of the key taken from your previous output
const privateKeyBodyLines = [
    "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCeNEUjaUkpSps0",
    "uBf4154n4VtV9WITDnLzUhjjqH3CGVTgCxu++m9t0uy34cVcQQwu7lgElmfLtEOt",
    "k9NYfTR9kMkMBzIv3Ui5YemqJmCqn5274fIIoc4lWipEjaXv1hhk7LxxAAH/Wfhy",
    "yYlnpgAT4xfhSRgWbwazj0NATK2Wlg+4wKg/15cxIzpi/tme4SPQj2Ptg0M9mGtd",
    "mEkTV36VmRoFVJyENcXWAvJYF5pNXEHSD7CMzytLLQmv7Nh4prpuemCugsOxvryn",
    "G3N4Y7RILXhdoeUqZu1wL7m6AaoL/4nAivbF+UzpEn04enydb5B6uEFv/9jOr58z",
    "/zDK5uvjAgMBAAECggEAAvVUQ6TA3vpLq7EzlY4moXVH2XQkuNmA0cb7uyoX6+zA",
    "Vw4uHySct8+FaKzanW6D9U60q6VKXJdK2rCUd6ejtyNhdw2dZSK8rObFUU61aQti",
    "DjTb60hnS/CDMNP7QeBdhWmd3nkTEHzUtgTJwnvqrXSGKkrNHgJGfE4WAlpMtq+h",
    "H/Ryp88IpiLajucd/Q+CPwb7oWZVGbYoSbGGlLWmkRhdHhyi3OK7ZvKEvKiYVpDa",
    "MfBjS5hdNBLEerIdEujFtsUkUjWL/5ue4imbzOPKXXC2f4Qi1FE2I1ArYP+2xgTb",
    "pyNpLzAlzCwF/ztZ/N20GSXrBjOjTUvM3yWpQs8IaQKBgQDZnnFCLm1ZdOisRyPT",
    "vfb7bIHKbTu8IDtMXCGffrofqFCXBoK0kxU958uCKra+nabrmR0oQ2s7BhFJg8PX",
    "Z5N48WnM87BH27pC2aTcBttAHLc8a2lyxOISFB4Vah42kViDcMhBf8rcF9P9j3aX",
    "tFudQYoLrzUUNlnUnGsR1KVNGwKBgQC6GzwoSUEzxvx5D7P7gE02zAjd1YQba6Uw",
    "lYEMwZVFSTYVpPE+1l5odFfh/NhzahtTwmHttVr/iEYlLjrO7WLsWvDOWxJcra0O",
    "KbEW+UucwGMiGZGtUIQ9U3CmDXDQzmQ/PGyuQWl00vPjWptmsV4dc3VoLRHlTQHi",
    "oD2oa7Kw2QKBgET8A/0tyH4uID/UgVfzBSMof3BS9jeppAKNxh7QRmIYsgteBfsG",
    "ERrBqvKFZc7BHRPcQrDrxkc8oihCu8dBzy7soFRW/4+X6NCeO7N//Oqy76cYiaHX",
    "Ja8Db5HsRM2Zf4yTKPgScZUZfJsJalem1c/g4cjYbqQMoqdSOmK5nPj3AoGAdMiE",
    "Xm9hiAE1Cy7MbWTcjydH5RSIGsDY3vziB0QuzFSdqMVhUWIpyfg/8aK9nOcXkN7o",
    "nsbv/GviQJCa/KDAM7r5YzSI+DlP4BRPeTAkv4+GZa6P2Kcu5GDIzpqekZkCFSBw",
    "voRzjYiW3LNN0wo4GdkK8r1dfnttVG3jYx15+zkCgYAKeI1V0l/7FSgaI7/YTfNp",
    "r6e9FcDqB+yDk9vIvBCSL4l2bKJDd1VqTPli1F+reeVCy7+Hd/RwJSSdDPKegtGa",
    "zhUzHzRHIt2emdK1kQOr/CMkGx4FDZ6qcth940EuTAH77Q5r0laOWpwLgqC0uUdl",
    "6SFyqFYG0FdZLnBQ8JoKmQ=="
];

const formattedKey = "-----BEGIN PRIVATE KEY-----\\n" + privateKeyBodyLines.join("\\n") + "\\n-----END PRIVATE KEY-----\\n";

// Completely rebuild the .env content to ensure no leftovers
const lines = content.split(/\r?\n/);
const filteredLines = lines.filter(line => !line.includes('FIREBASE_PRIVATE_KEY') && !line.includes('MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCeNEUjaUkpSps0'));
// Note: filtering for that specific line is a hack to clean up leftovers

const newLines = [];
let keyAdded = false;
for (const line of filteredLines) {
    if (line.startsWith('FIREBASE_CLIENT_EMAIL=') && !keyAdded) {
        newLines.push(line);
        newLines.push('');
        newLines.push(`FIREBASE_PRIVATE_KEY="\${formattedKey}"`);
        keyAdded = true;
    } else if (line.trim() || true) {
        // Keep even empty lines for formatting
        newLines.push(line);
    }
}

fs.writeFileSync(envPath, newLines.join('\n'));
console.log('Successfully rebuilt .env file');
