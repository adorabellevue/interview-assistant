import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid'; 
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import path from 'path';

// Explicitly load .env from the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('[ROUTE.JS] GEMINI_API_KEY from process.env:', process.env.GEMINI_API_KEY ? `******${process.env.GEMINI_API_KEY.slice(-6)}` : 'NOT FOUND');
// --- End Debugging ---

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function askGeminiImplementation(promptOrRequest) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });

  try {
  
    const result = await model.generateContent(promptOrRequest);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (err) {
    console.error('Gemini API error:', err);
    return 'Error contacting Gemini API.';
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