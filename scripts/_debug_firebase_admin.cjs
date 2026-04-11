const fs = require("fs");
const crypto = require("crypto");
const { cert, initializeApp } = require("firebase-admin/app");

const envText = fs.readFileSync(".env", "utf8");

const getEnv = (key) => {
  const match = envText.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1] : undefined;
};

const cleanEnvValue = (value) => {
  if (value == null) return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const projectId = cleanEnvValue(getEnv("FIREBASE_PROJECT_ID"));
const clientEmail = cleanEnvValue(getEnv("FIREBASE_CLIENT_EMAIL"));
const privateKey = cleanEnvValue(getEnv("FIREBASE_PRIVATE_KEY"))
  ?.replace(/\\n/g, "\n")
  .replace(/\r\n/g, "\n");

console.log("projectId:", projectId);
console.log("clientEmail:", clientEmail);
console.log("privateKey length:", privateKey?.length ?? 0);
console.log("privateKey head:", JSON.stringify((privateKey || "").slice(0, 40)));
console.log("privateKey tail:", JSON.stringify((privateKey || "").slice(-40)));

try {
  crypto.createPrivateKey({ key: privateKey, format: "pem" });
  console.log("crypto parse: ok");
} catch (error) {
  console.log("crypto parse: failed");
  console.log(error?.message);
}

try {
  initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    },
    "debug-firebase-admin"
  );
  console.log("firebase-admin cert init: ok");
} catch (error) {
  console.log("firebase-admin cert init: failed");
  console.log("name:", error?.name);
  console.log("code:", error?.code);
  console.log("message:", error?.message);
  console.log("errorInfo:", error?.errorInfo);
}
