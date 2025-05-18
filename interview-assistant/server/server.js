import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid'; // Add this import
import * as url from 'url'; // Import the full url module
import { geminiService, recordingRoutes } from "./route.js"; // Updated import
import multer from 'multer'; // Added for file uploads
import fs from 'fs'; // Added for file system operations
import { promisify } from 'util'; // To use fs.readFile with async/await

dotenv.config();

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
  console.log("Transcript:", transcript);
  console.log("Questions:", questions);

  try {
    const prompt = `Based on our interview transcript and current list of interview questions, give me 1 additional
    question to ask the candidate. The question should be relevant to the transcript and the current list of questions. Format your response exactly like this:
QUESTION: "Your follow-up question here?" You may include a short explanation of why you chose this question on a new line after.
    Transcript: ${transcript}\n\nQuestions:\n${questions.join("\n")}`;
    const reply = await geminiService.askGemini(prompt); // Updated call

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
      const firebaseKeyPath = path.join(__dirname, '../../transcription/API-keys/interviewer-assistant-e76d2-firebase-adminsdk-fbsvc-e22c760bf0.json');
      
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

// New endpoint for processing resume and job description
app.post("/process-documents", upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'jobDescription', maxCount: 1 }]), async (req, res) => {
  try {
    if (!req.files || !req.files.resume || !req.files.jobDescription) {
      return res.status(400).json({ error: "Both resume (PDF) and job description (text file) are required." });
    }

    const resumeFile = req.files.resume[0];
    const jobDescriptionFile = req.files.jobDescription[0];

    // Read resume PDF as base64
    const resumeBuffer = await readFileAsync(resumeFile.path);
    const resumeBase64 = resumeBuffer.toString('base64');

    // Read job description content as text
    const jobDescriptionContent = await readFileAsync(jobDescriptionFile.path, 'utf8');

    // Construct the multimodal request for the LLM
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

    
    const llmResponse = await geminiService.askGemini(llmRequest); 

    // Parse the LLM response (assuming questions are separated by newlines and start with "QUESTION: ")
    const generatedQuestions = llmResponse
      .split('\n')
      .filter(line => line.startsWith("QUESTION: "))
      .map(line => line.substring("QUESTION: ".length).trim())
      .filter(question => question.length > 0);

    if (generatedQuestions.length === 0) {
      // Fallback or error handling if no questions were parsed
      console.error("LLM did not return questions in the expected format. Response:", llmResponse);
      // Provide some default questions or indicate an issue
      generatedQuestions.push("Could you walk me through your resume?", "What interested you most about this job description?");
    }

    // Clean up uploaded files after processing
    fs.unlinkSync(resumeFile.path);
    fs.unlinkSync(jobDescriptionFile.path);

    res.json({
      questions: generatedQuestions,
      type: 'initial_questions',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error processing documents:", error);
    // Clean up files in case of error too, if they exist
    if (req.files && req.files.resume && req.files.resume[0] && fs.existsSync(req.files.resume[0].path)) {
      fs.unlinkSync(req.files.resume[0].path);
    }
    if (req.files && req.files.jobDescription && req.files.jobDescription[0] && fs.existsSync(req.files.jobDescription[0].path)) {
      fs.unlinkSync(req.files.jobDescription[0].path);
    }
    res.status(500).json({ error: "Failed to process documents." });
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