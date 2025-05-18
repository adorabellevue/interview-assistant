import dotenv from 'dotenv';
dotenv.config();
import { v4 as uuidv4 } from 'uuid'; 
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function askGeminiImplementation(promptOrRequest) {
  // const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-pro' });
  // Use gemini-1.5-flash as it's generally good for mixed modality and often faster/cheaper.
  // You can switch to gemini-1.5-pro if flash is not sufficient.
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });

  try {
    // If promptOrRequest is a string, it's a simple text prompt (backward compatible)
    // Otherwise, it's assumed to be a request object for generateContent (e.g., for multimodal)
    const result = await model.generateContent(promptOrRequest);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (err) {
    console.error('Gemini API error:', err);
    return '❌ Error contacting Gemini API.';
  }
}

export const geminiService = {
  askGemini: askGeminiImplementation
};

export const recordingRoutes = {
  startRecording: async (req, res) => {
    try {
      // session id
      const sessionId = uuidv4();
      
      res.json({
        success: true,
        session_id: sessionId,
        message: 'Recording started'
      });
      
      // Return the session ID for server.js to use
      return sessionId;
    } catch (error) {
      console.error('Start recording error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to start recording'
      });
      throw error;
    }
  },

  stopRecording: async (req, res) => {
    try {
      res.json({
        success: true,
        message: 'Recording stopped'
      });
      return true;
    } catch (error) {
      console.error('Stop recording error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to stop recording'
      });
      throw error;
    }
  }
};