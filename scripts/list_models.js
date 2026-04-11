// scripts/list_models.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access API key from environment variables
const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;

if (!apiKey) {
  console.error("No API key provided");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Just to get the class
    // actually listModels is on the instance or class?
    // It's not directly exposed on GoogleGenerativeAI instance easily without a model manager in some versions
    // But typically we can just try to fetch a known model or correct the name.
    
    // In 0.24.1, we might not have listModels directly on genAI. It's usually a separate call.
    // But let's try to just run a simple generateContent with gemini-2.0-flash-exp and gemini-1.5-flash-8b
    
    // Instead of listing (which requires checking docs/source), let's just try 2-3 standard names.
    
    const modelsToTest = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-001",
        "gemini-flash-1.5",
        "gemini-2.0-flash-exp",
        "gemini-2.0-flash"
    ];
    
    console.log("Testing models...");
    
    for (const modelName of modelsToTest) {
        console.log(`Testing ${modelName}...`);
        try {
            const m = genAI.getGenerativeModel({ model: modelName });
            await m.generateContent("Hello");
            console.log(`SUCCESS: ${modelName} is working.`);
            break; 
        } catch (e) {
            console.log(`FAILED: ${modelName} - ${e.message.split('\n')[0]}`);
        }
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();
