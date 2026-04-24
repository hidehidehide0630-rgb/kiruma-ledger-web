const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set in .env file.");
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (data.error) {
      console.error("API Error:", data.error);
      return;
    }

    console.log("=== 利用可能なモデル一覧 ===");
    if (data.models) {
      data.models.forEach(m => {
        const name = m.name.replace('models/', '');
        console.log(`- ${name} (${m.displayName})`);
      });
    } else {
      console.log("利用可能なモデルが見つかりませんでした。");
    }
  } catch (e) {
    console.error("Fetch Error:", e.message);
  }
}

listModels();
