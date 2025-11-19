import { GoogleGenAI } from "@google/genai";
import { DHLShipment } from "../types";

// Helper to initialize Gemini
const getGemini = () => {
  // In a real app, strict env var checking. Here we assume it's available or handle gracefully.
  if (!process.env.API_KEY) {
    throw new Error("Gemini API Key is missing.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeShipment = async (shipment: DHLShipment): Promise<string> => {
  try {
    const ai = getGemini();
    
    // Prepare the prompt context
    const eventsSummary = shipment.events
      .slice(0, 5) // Take last 5 events
      .map(e => `${e.date} ${e.time}: ${e.description} at ${e.serviceArea?.[0]?.description || 'Unknown Loc'}`)
      .join('\n');

    const prompt = `
      You are a helpful logistics assistant. 
      Analyze the following DHL tracking history for tracking number ${shipment.id}.
      
      Current Status: ${shipment.status.description}
      Recent Events:
      ${eventsSummary}
      
      Please provide a short, friendly summary (max 2-3 sentences) in simple English explaining the status to the customer. 
      If there are any potential delays or technical terms (like 'Clearance Event'), explain them briefly.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Unable to generate analysis.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI analysis currently unavailable.";
  }
};
