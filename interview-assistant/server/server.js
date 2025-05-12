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

app.post("/start-recording", (req, res) => {
  try {
    // Here you'll need to implement the logic to start your Python script
    // You might want to use child_process to spawn the Python script
    res.json({ message: "Recording started" });
  } catch (error) {
    res.status(500).json({ error: "Failed to start recording" });
  }
});

app.post("/stop-recording", (req, res) => {
  try {
    // Implement logic to stop the Python script
    res.json({ message: "Recording stopped" });
  } catch (error) {
    res.status(500).json({ error: "Failed to stop recording" });
  }
});

app.listen(5001, () => {
  console.log("🧠 Gemini backend running at http://localhost:5001");
});