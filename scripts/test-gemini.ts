import { GoogleGenerativeAI } from "@google/generative-ai";

async function testGemini() {
  try {
    const key = process.env.GEMINI_API_KEY;
    console.log('Key length:', key?.length);
    const genAI = new GoogleGenerativeAI(key!);
    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
    const result = await model.generateContent("Hello, reply with exactly the word OK.");
    console.log("Response:", result.response.text());
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

testGemini();
