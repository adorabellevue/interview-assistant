import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as url from 'url';
import { geminiService, recordingRoutes } from "./route.js";
import multer from 'multer'; // Added for file uploads
import fs from 'fs'; // Added for file system operations
import { promisify } from 'util'; // To use fs.readFile with async/await

dotenv.config();

// Initialize in-memory blacklist
let blacklistedQuestions = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "resume") {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Resume must be a PDF file.'), false);
    }
  } else {
    cb(null, true); // Allow other files through by default
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });
const readFileAsync = promisify(fs.readFile);

let pythonProcess = null;

app.post("/from-python", async (req, res) => {
  const { transcript, questions } = req.body;
  // console.log("Transcript:", transcript);
  // console.log("Questions:", questions);

  try {
    let blacklistInstruction = "";
    if (blacklistedQuestions.length > 0) {
      blacklistInstruction = `\n\nIMPORTANT: Avoid generating questions similar to any of the following previously dismissed questions:\n- ${blacklistedQuestions.join("\n- ")}`;
    }

    const prompt = `Based on our interview transcript and current list of interview questions, give me 1 additional
    question to ask the candidate. The question should be relevant to the transcript and the current list of questions. Format your response exactly like this:
QUESTION: "Your follow-up question here?" You may include a short explanation of why you chose this question on a new line after.
    Transcript: ${transcript}\n\nQuestions:\n${questions.join("\n")}${blacklistInstruction}`;
    
    // console.log("Prompt to Gemini for follow-up:", prompt); // For debugging
    const reply = await geminiService.askGemini(prompt);

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
      
      let firebaseKeyPathForPython;
      const hardcodedFallbackPath = path.join(__dirname, '../../transcription/API-keys/interviewer-assistant-e76d2-firebase-adminsdk-fbsvc-e22c760bf0.json');

      if (process.env.FIREBASE_KEY) {
        firebaseKeyPathForPython = process.env.FIREBASE_KEY;
        console.log(`[server.js] Using FIREBASE_KEY from .env. Path for Python script: ${firebaseKeyPathForPython}`);
      } else {
        firebaseKeyPathForPython = hardcodedFallbackPath;
        console.log(`[server.js] FIREBASE_KEY not found in .env. Using hardcoded fallback path for Python script: ${firebaseKeyPathForPython}`);
      }

      const spawnEnv = { 
        ...process.env,
        ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY,
        SESSION_ID: sessionId
      };
      
      console.log(`[server.js] Spawning Python script. Path: ${scriptPath}. CWD: ${path.join(__dirname, '../../transcription')}.`);
      console.log("[server.js] Python script environment will include (relevant vars):", 
        Object.fromEntries(Object.entries(spawnEnv).filter(([key]) => ['ASSEMBLYAI_API_KEY', 'SESSION_ID'].includes(key) || key.startsWith('PYTHON')))
      );
      
      const finalPythonArgs = [scriptPath, sessionId, firebaseKeyPathForPython];

      pythonProcess = spawn('python3', finalPythonArgs, { // Adjust if using custom Python env
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'], 
        env: spawnEnv,
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
    const sessionId = req.body.session_id;
    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id in request." });
    }
    
    // Stop transcription process
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }

    // Run fetch_transcript.py with sessionID
    const scriptPath = path.join(__dirname, '../../transcription/fetch_transcript.py');
    const python = spawn('python', [scriptPath, sessionId], {
      cwd: path.join(__dirname, '../../transcription'),
    });
    
    let fullTranscript = '';
    python.stdout.on('data', (data) => {
      fullTranscript += data.toString();
    });

    python.stderr.on('data', (data) => {
      console.error(`[fetch_transcript.py] error: ${data}`);
    });

    python.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: `fetch_transcript.py exited with code ${code}` });
      }
      console.log(`[server.js] Full transcript for session ${sessionId}:\n${fullTranscript}`);
      res.json({
        success: true,
        session_id: sessionId,
        transcript: fullTranscript.trim(),
        message: 'Recording stopped and transcript retrieved'
      });
    });
  } catch (error) {
    console.error('Stop recording error:', error);
    res.status(500).json({ error: "Failed to stop recording" });
  }
});

// New endpoint for processing resume and job description
app.post("/process-documents", upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'jobDescription', maxCount: 1 }]), async (req, res) => {
  try {
    if (!req.files || !req.files.resume || !req.files.jobDescription) {
      return res.status(400).json({ error: "Both resume (PDF) and job description (text file) are required." });
    }

    const resumeFile = req.files.resume[0];
    const jobDescriptionFile = req.files.jobDescription[0];

    const resumeBuffer = await readFileAsync(resumeFile.path);
    const resumeBase64 = resumeBuffer.toString('base64');
    const jobDescriptionContent = await readFileAsync(jobDescriptionFile.path, 'utf8');

    const llmRequest = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
Based on the provided resume (which is a PDF document) and the job description (text that follows), please generate 5-7 insightful initial interview questions.
The questions should help assess the candidate's suitability for the role described.
Ensure the questions are open-ended and encourage detailed responses.
Format each question on a new line, starting with "QUESTION: ".

Job Description:
---
${jobDescriptionContent}
---

Generated Questions based on both documents:
`
            },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: resumeBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
      },
    };

    const llmResponseString = await geminiService.askGemini(llmRequest);

    const generatedQuestions = llmResponseString
      .split('\n')
      .filter(line => line.startsWith("QUESTION: "))
      .map(line => line.substring("QUESTION: ".length).trim())
      .filter(question => question.length > 0);

    if (generatedQuestions.length === 0 && llmResponseString) { 
      console.warn("LLM did not return questions in the expected format for /process-documents. Response:", llmResponseString);
    }

    fs.unlinkSync(resumeFile.path);
    fs.unlinkSync(jobDescriptionFile.path);

    res.json({
      questions: generatedQuestions,
      type: 'initial_questions',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error processing documents:", error);
    // Clean up uploaded files in case of error
    if (req.files && req.files.resume && req.files.resume[0] && fs.existsSync(req.files.resume[0].path)) {
      fs.unlinkSync(req.files.resume[0].path);
    }
    if (req.files && req.files.jobDescription && req.files.jobDescription[0] && fs.existsSync(req.files.jobDescription[0].path)) {
      fs.unlinkSync(req.files.jobDescription[0].path);
    }
    res.status(500).json({ error: error.message || "Failed to process documents." });
  }
});

// New endpoint for blacklisting questions
app.post("/api/blacklist-question", (req, res) => {
  const { questionText } = req.body;
  if (questionText && typeof questionText === 'string') {
  const trimmedQuestion = questionText.trim();
    if (trimmedQuestion && !blacklistedQuestions.includes(trimmedQuestion)) {
      blacklistedQuestions.push(trimmedQuestion);
      console.log("Blacklisted question:", trimmedQuestion);
      console.log("Current blacklist:", blacklistedQuestions);
      res.status(200).json({ message: "Question blacklisted successfully." });
    } else if (blacklistedQuestions.includes(trimmedQuestion)) {
      res.status(200).json({ message: "Question already blacklisted." });
    } 
    else {
      res.status(400).json({ error: "Cannot blacklist an empty question." });
    }
  } else {
    res.status(400).json({ error: "Invalid question text provided." });
  }
});

// Post-interview summary
app.post("/summarize-transcript", async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript || transcript.trim().length < 10) {
      return res.status(400).json({ error: "Transcript is too short to summarize." });
    }

    const prompt = `
    Summarize the following job interview transcript. Focus on the candidate's strengths, areas for improvement, and any themes or topics discussed.
    Avoid repeating the entire transcript.

    Transcript:
    ---
    ${transcript}
    ---
    `;

    const summary = await geminiService.askGemini(prompt);
    res.json({ summary });
  } catch (error) {
    console.error("Summarization error:", error);
    res.status(500).json({ error: "Failed to generate summary." });
  }
});

// Basic error handling middleware (add this before the export)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading.
    return res.status(400).json({ error: err.message });
  } else if (err) {
    // For other errors passed from fileFilter or elsewhere
    if (err.message && (err.message.includes('Resume must be a PDF') || err.message.includes('Job description must be'))) {
        return res.status(400).json({ error: err.message });
    }
    // An unknown error occurred.
    console.error("Unhandled error:", err);
    return res.status(500).json({ error: 'Internal server error' });
  }
  next();
});

// Start server only if this file is run directly
const isMainModule = import.meta.url === url.pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  app.listen(5001, () => {
    console.log("Server running at http://localhost:5001");
  });
}

export default app;