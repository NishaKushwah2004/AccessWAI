// backend/routes/analysis.js
import express from "express";
const router = express.Router();
import multer from "multer";
import AdmZip from "adm-zip";
import os from "os";
import path from "path";
import fs from "fs";
import { protect } from "../middleware/auth.js";
import Analysis from "../models/Analysis.js";
import {
  analyzeAccessibility,
  getAISuggestions,
} from "../controllers/analysisController.js";

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(os.tmpdir(), "uploads");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are allowed"), false);
    }
  },
});

// Upload and analyze project
router.post("/upload", protect, upload.single("project"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload a project file" });
    }

    const { projectName } = req.body;

    let zip;
    try {
      zip = new AdmZip(req.file.path);
    } catch (zipError) {
      return res.status(400).json({
        message: "Invalid ZIP file. Please upload a valid ZIP archive.",
      });
    }

    const zipEntries = zip.getEntries();

    const files = [];
    zipEntries.forEach((entry) => {
      if (
        !entry.isDirectory &&
        /\.(html|jsx|js|tsx|ts)$/i.test(entry.entryName)
      ) {
        try {
          files.push({
            name: entry.entryName,
            content: entry.getData().toString("utf8"),
          });
        } catch (err) {
          console.error(`Error reading file ${entry.entryName}:`, err);
        }
      }
    });

    if (files.length === 0) {
      return res.status(400).json({
        message:
          "No HTML/JSX/JS/TS/TSX files found in the ZIP. Please upload a web project.",
      });
    }

    // Analyze files
    const issues = analyzeAccessibility(files);

    // Calculate summary
    const summary = {
      critical: issues.filter((i) => i.severity === "critical").length,
      high: issues.filter((i) => i.severity === "high").length,
      medium: issues.filter((i) => i.severity === "medium").length,
      low: issues.filter((i) => i.severity === "low").length,
    };

    const totalIssues =
      summary.critical + summary.high + summary.medium + summary.low;
    const accessibilityScore = Math.max(
      0,
      100 -
        (summary.critical * 10 +
          summary.high * 5 +
          summary.medium * 2 +
          summary.low * 0.5),
    );

    // Get AI suggestions
    const aiSuggestions = await getAISuggestions(issues, files);

    const analysis = await Analysis.create({
      userId: req.user._id,
      projectName: projectName || "Untitled Project",
      filesAnalyzed: files.length,
      issues,
      summary,
      accessibilityScore: Math.round(accessibilityScore),
      aiSuggestions,
    });

    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Failed to delete temp file:", err);
    });

    res.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    res
      .status(500)
      .json({ message: "Error analyzing project", error: error.message });
  }
});

// Get all analyses for user
router.get("/history", protect, async (req, res) => {
  try {
    const analyses = await Analysis.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select("-issues"); // Exclude full issues for list view

    res.json(analyses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching history", error: error.message });
  }
});

// Get single analysis
router.get("/:id", protect, async (req, res) => {
  try {
    const analysis = await Analysis.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    res.json(analysis);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching analysis", error: error.message });
  }
});

// Delete analysis
router.delete("/:id", protect, async (req, res) => {
  console.log("DELETE request by user:", req.user._id);
  console.log("Trying to delete analysis:", req.params.id);

  const analysis = await Analysis.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  console.log("Delete result:", analysis);

  if (!analysis) {
    return res.status(404).json({ message: "Analysis not found" });
  }

  res.json({ message: "Analysis deleted successfully" });
});

export default router;
