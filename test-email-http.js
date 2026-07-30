const BREVO_API_KEY = "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";
const BREVO_SENDER_EMAIL = "tanwaranantsingh10@gmail.com";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

async function testHttp() {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "ZenAI", email: BREVO_SENDER_EMAIL },
        to: [{ email: "tanwaranantsingh10@gmail.com", name: "Anant" }],
        subject: "Test HTTP API",
        textContent: "Hello this is a test.",
      }),
    });

    if (!response.ok) {
      console.log("Error:", await response.text());
    } else {
      console.log("Success:", await response.json());
    }
  } catch (err) {
    console.error(err);
  }
}

testHttp();
