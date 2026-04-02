import express from "express";
import cors from "cors";
import path from "path";
import { authRouter } from "./auth/routes";
import { logsRouter } from "./logs/routes";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/logs", logsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`LogSentry backend running on port ${PORT}`);
});
