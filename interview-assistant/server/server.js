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
    const prompt = `Transcript: ${transcript}\n\nQuestions:\n${questions.join("\n")}`;
    const reply = await askGemini(prompt);
    res.json({ reply });
  } catch (err) {
    console.error("Gemini error:", err);
    res.status(500).json({ error: "Gemini API failed." });
  }
});

app.listen(5001, () => {
  console.log("🧠 Gemini backend running at http://localhost:5001");
});