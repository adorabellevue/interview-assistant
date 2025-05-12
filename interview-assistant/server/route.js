import dotenv from 'dotenv';
dotenv.config();
import { v4 as uuidv4 } from 'uuid'; 
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function askGemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-pro' });

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (err) {
    console.error('Gemini API error:', err);
    return '❌ Error contacting Gemini API.';
  }
}

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