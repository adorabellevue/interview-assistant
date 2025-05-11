import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { askGemini } from "./route.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/from-python", async (req, res) => {
  const { transcript, questions } = req.body;

  console.log("📝 Transcript:", transcript);
  console.log("❓ Questions:", questions);

  try {
    const prompt = `Based on our interview transcript and current list of interview questions, give me 1 additional
    question to ask the candidate. The question should be relevant to the transcript and the current list of questions. 
    Transcript: ${transcript}\n\nQuestions:\n${questions.join("\n")}`;
    const reply = await askGemini(prompt);
    res.json({ reply });
  } catch (err) {
    console.error("Gemini API error:", err);
    res.status(500).json({ error: "Gemini API failed." });
  }
});

app.listen(5001, () => {
  console.log("🧠 Gemini backend running at http://localhost:5001");
});