import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid'; // Add this import
import { askGemini, recordingRoutes } from "./route.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

let pythonProcess = null;

app.post("/from-python", async (req, res) => {
  const { transcript, questions } = req.body;
  console.log("📝 Transcript:", transcript);
  console.log("❓ Questions:", questions);

  try {
    const prompt = `Based on our interview transcript and current list of interview questions, give me 1 additional
    question to ask the candidate. The question should be relevant to the transcript and the current list of questions. Format your response exactly like this:
QUESTION: "Your follow-up question here?" You may include a short explanation of why you chose this question on a new line after.
    Transcript: ${transcript}\n\nQuestions:\n${questions.join("\n")}`;
    const reply = await askGemini(prompt);

    res.json({
      reply,
      type: 'llm_response',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Gemini API error:", err);
    res.status(500).json({ error: "Gemini API failed." });
  }
});

app.post("/start-recording", async (req, res) => {
  try {
    const sessionId = uuidv4();
    console.log("sessionId", sessionId);
    
    if (!pythonProcess) {
      const scriptPath = path.join(__dirname, '../../transcription/realtime_assemblyai.py');
      const firebaseKeyPath = path.join(__dirname, '../../transcription/API-keys/interviewer-assistant-e76d2-firebase-adminsdk-fbsvc-2de2175327.json');
      
      pythonProcess = spawn('python3', [scriptPath], {
        env: {
          ...process.env,
          ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY,
          FIREBASE_KEY: firebaseKeyPath,
          SESSION_ID: sessionId 
        },
        cwd: path.join(__dirname, '../../transcription') 
      });

      pythonProcess.stdout.on('data', (data) => {
        console.log(`Python output: ${data.toString()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`Python error: ${data.toString()}`);
      });

      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        throw error;
      });

      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
        pythonProcess = null;
      });
    }
    
    res.json({
      success: true,
      session_id: sessionId,
      message: 'Recording started'
    });
    
  } catch (error) {
    console.error('Start recording error:', error);
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }
    res.status(500).json({ error: error.message || "Failed to start recording" });
  }
});

app.post("/stop-recording", async (req, res) => {
  try {
    const result = await recordingRoutes.stopRecording(req, res);
    
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }

    res.json(result);
  } catch (error) {
    console.error('Stop recording error:', error);
    res.status(500).json({ error: "Failed to stop recording" });
  }
});

app.listen(5001, () => {
  console.log("🧠 Server running at http://localhost:5001");
});