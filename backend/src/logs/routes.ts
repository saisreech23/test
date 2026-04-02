import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../db";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { parseLogFile } from "./parser";
import { analyzeLogEntries } from "./analyzer";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    const allowedExts = [".log", ".txt", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .log, .txt, and .csv files are allowed"));
    }
  },
});

export const logsRouter = Router();

// All routes require authentication
logsRouter.use(authenticateToken);

// POST /api/logs/upload — Upload and analyze a log file
logsRouter.post(
  "/upload",
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      // Create upload record
      const uploadRecord = await prisma.upload.create({
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          status: "processing",
          userId: req.userId!,
        },
      });

      // Send immediate response — processing happens async
      res.status(202).json({
        uploadId: uploadRecord.id,
        status: "processing",
        message: "File uploaded successfully. Analysis in progress.",
      });

      // Process in background
      processLogFile(uploadRecord.id, req.file.path).catch((err) => {
        console.error(`Processing failed for upload ${uploadRecord.id}:`, err);
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

// Background processing function
async function processLogFile(
  uploadId: string,
  filePath: string
): Promise<void> {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const entries = parseLogFile(content);

    if (entries.length === 0) {
      await prisma.upload.update({
        where: { id: uploadId },
        data: { status: "failed" },
      });
      return;
    }

    // Store parsed log entries in DB
    await prisma.logEntry.createMany({
      data: entries.map((e) => ({
        uploadId,
        lineNumber: e.lineNumber,
        timestamp: e.timestamp,
        sourceIp: e.sourceIp,
        method: e.method,
        url: e.url,
        statusCode: e.statusCode,
        userAgent: e.userAgent,
        bytesSent: e.bytesSent,
        responseTime: e.responseTime,
        rawLine: e.rawLine,
      })),
    });

    // Run AI analysis
    const analysis = await analyzeLogEntries(entries);

    // Mark anomalies in DB
    for (const anomaly of analysis.anomalies) {
      await prisma.logEntry.updateMany({
        where: { uploadId, lineNumber: anomaly.lineNumber },
        data: {
          isAnomaly: true,
          anomalyReason: anomaly.reason,
          anomalyScore: anomaly.score,
        },
      });
    }

    // Store analysis results
    await prisma.analysis.create({
      data: {
        uploadId,
        summary: analysis.summary,
        timeline: analysis.timeline as any,
        threatLevel: analysis.threatLevel,
        totalEntries: entries.length,
        anomalyCount: analysis.anomalies.length,
        topIps: (await prisma.logEntry.groupBy({
          by: ["sourceIp"],
          where: { uploadId },
          _count: true,
          orderBy: { _count: { sourceIp: "desc" } },
          take: 10,
        })).map((r) => ({ ip: r.sourceIp, count: r._count })),
        statusBreakdown: {
          "2xx": entries.filter((e) => e.statusCode >= 200 && e.statusCode < 300).length,
          "3xx": entries.filter((e) => e.statusCode >= 300 && e.statusCode < 400).length,
          "4xx": entries.filter((e) => e.statusCode >= 400 && e.statusCode < 500).length,
          "5xx": entries.filter((e) => e.statusCode >= 500).length,
        },
        keyFindings: analysis.keyFindings,
      },
    });

    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: "completed" },
    });
  } catch (err) {
    console.error("Processing error:", err);
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: "failed" },
    });
  }
}

// GET /api/logs/uploads — List user's uploads
logsRouter.get("/uploads", async (req: AuthRequest, res: Response) => {
  try {
    const uploads = await prisma.upload.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: {
        analysis: {
          select: {
            threatLevel: true,
            totalEntries: true,
            anomalyCount: true,
          },
        },
      },
    });
    res.json({ uploads });
  } catch (err) {
    console.error("List uploads error:", err);
    res.status(500).json({ error: "Failed to list uploads" });
  }
});

// GET /api/logs/uploads/:id — Get full analysis for an upload
logsRouter.get("/uploads/:id", async (req: AuthRequest, res: Response) => {
  try {
    const upload = await prisma.upload.findFirst({
      where: { id: req.params.id as string, userId: req.userId as string },
      include: { analysis: true },
    });

    if (!upload) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }

    res.json({ upload });
  } catch (err) {
    console.error("Get upload error:", err);
    res.status(500).json({ error: "Failed to get upload" });
  }
});

// GET /api/logs/uploads/:id/entries — Get log entries with pagination
logsRouter.get(
  "/uploads/:id/entries",
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const anomaliesOnly = req.query.anomalies === "true";

      const where: any = {
        uploadId: req.params.id,
        upload: { userId: req.userId },
      };
      if (anomaliesOnly) where.isAnomaly = true;

      const [entries, total] = await Promise.all([
        prisma.logEntry.findMany({
          where,
          orderBy: { lineNumber: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.logEntry.count({ where }),
      ]);

      res.json({
        entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("Get entries error:", err);
      res.status(500).json({ error: "Failed to get entries" });
    }
  }
);
