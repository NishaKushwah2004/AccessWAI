
// backend/models/Analysis.js
import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema({
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    required: true
  },
  type: String,
  file: String,
  line: Number,
  description: String,
  suggestion: String,
  code: String
});

const analysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectName: {
    type: String,
    required: true
  },
  filesAnalyzed: Number,
  issues: [issueSchema],
  summary: {
    critical: { type: Number, default: 0 },
    high: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    low: { type: Number, default: 0 }
  },
  accessibilityScore: {
    type: Number,
    min: 0,
    max: 100
  },
  aiSuggestions: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Analysis = mongoose.model('Analysis', analysisSchema);

export default Analysis;