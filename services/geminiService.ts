
import { GoogleGenAI } from "@google/genai";

export const summarizeDocument = async (text: string): Promise<string> => {
  // Always initialize GoogleGenAI inside the function to ensure the most current environment context is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Please provide a concise and professional summary of the following document text:\n\n${text.substring(0, 10000)}`,
      config: {
        systemInstruction: "You are a professional document assistant. Summarize content accurately and briefly.",
      }
    });
    // Accessing the .text property directly as it is not a method.
    return response.text || "No summary could be generated.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Error generating summary. Please ensure your API key is active.";
  }
};
