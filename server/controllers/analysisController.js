// backend/controllers/analysisController.js
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();

// Accessibility analysis rules
const analyzeAccessibility = (files) => {
  const issues = [];

  files.forEach((file) => {
    const lines = file.content.split("\n");

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for images without alt text
      if (/<img(?![^>]*alt=)/i.test(line)) {
        issues.push({
          severity: "critical",
          type: "Missing Alt Text",
          file: file.name,
          line: lineNum,
          description:
            "Image element is missing alt attribute for screen readers",
          suggestion:
            'Add an alt attribute describing the image content. Example: <img src="..." alt="Description of image" />',
          code: line.trim(),
        });
      }

      // Check for empty alt text on non-decorative images
      if (
        /<img[^>]*alt=""[^>]*src=/i.test(line) &&
        !line.includes("decorative")
      ) {
        issues.push({
          severity: "medium",
          type: "Empty Alt Text",
          file: file.name,
          line: lineNum,
          description: "Image has empty alt text but may not be decorative",
          suggestion:
            'If the image is decorative, use alt="" or role="presentation". Otherwise, provide descriptive alt text.',
          code: line.trim(),
        });
      }

      // Check for buttons without accessible text
      if (
        /<button[^>]*>[\s]*<\/button>/i.test(line) ||
        /<button[^>]*><i /i.test(line)
      ) {
        issues.push({
          severity: "high",
          type: "Button Without Text",
          file: file.name,
          line: lineNum,
          description:
            "Button has no accessible text content for screen readers",
          suggestion:
            'Add visible text or aria-label to the button. Example: <button aria-label="Submit form">Submit</button>',
          code: line.trim(),
        });
      }

      // Check for missing form labels
      if (
        /<input(?![^>]*(aria-label|aria-labelledby))/i.test(line) &&
        !/<input[^>]*type=["']?(hidden|submit|button)/i.test(line)
      ) {
        const hasLabel = lines
          .slice(Math.max(0, index - 2), index + 3)
          .some((l) => /<label/i.test(l));

        if (!hasLabel) {
          issues.push({
            severity: "high",
            type: "Missing Form Label",
            file: file.name,
            line: lineNum,
            description: "Input field lacks an associated label",
            suggestion:
              'Add a <label> element or aria-label attribute. Example: <label for="name">Name:</label><input id="name" />',
            code: line.trim(),
          });
        }
      }

      // Check for insufficient color contrast indicators
      if (/style=["'][^"']*color:\s*#?([a-f0-9]{3}|[a-f0-9]{6})/i.test(line)) {
        issues.push({
          severity: "medium",
          type: "Potential Color Contrast Issue",
          file: file.name,
          line: lineNum,
          description:
            "Inline color styling detected - verify WCAG color contrast ratios",
          suggestion:
            "Ensure text has at least 4.5:1 contrast ratio with background (3:1 for large text). Use a contrast checker tool.",
          code: line.trim(),
        });
      }

      // Check for missing heading hierarchy
      if (/<h([1-6])/i.test(line)) {
        const match = line.match(/<h([1-6])/i);
        const headingLevel = parseInt(match[1]);

        // Simple check - could be enhanced
        if (headingLevel > 2 && index < 50) {
          issues.push({
            severity: "low",
            type: "Heading Hierarchy",
            file: file.name,
            line: lineNum,
            description: `H${headingLevel} used early in document - verify proper heading hierarchy`,
            suggestion:
              "Use headings in sequential order (h1, h2, h3) to create a logical document structure.",
            code: line.trim(),
          });
        }
      }

      // Check for missing language attribute
      if (/<html(?![^>]*lang=)/i.test(line)) {
        issues.push({
          severity: "high",
          type: "Missing Language Attribute",
          file: file.name,
          line: lineNum,
          description: "HTML element missing lang attribute",
          suggestion:
            'Add lang attribute to help screen readers. Example: <html lang="en">',
          code: line.trim(),
        });
      }

      // Check for non-semantic divs used as buttons
      if (
        /<div[^>]*onclick=/i.test(line) &&
        !/<div[^>]*role=["']button/i.test(line)
      ) {
        issues.push({
          severity: "high",
          type: "Non-Semantic Interactive Element",
          file: file.name,
          line: lineNum,
          description:
            "Div with click handler should be a button or have proper ARIA role",
          suggestion:
            'Use <button> element or add role="button" and keyboard event handlers.',
          code: line.trim(),
        });
      }

      // Check for links without descriptive text
      if (
        /<a[^>]*>[\s]*(click here|read more|here|more)[\s]*<\/a>/i.test(line)
      ) {
        issues.push({
          severity: "medium",
          type: "Non-Descriptive Link Text",
          file: file.name,
          line: lineNum,
          description: "Link text is not descriptive",
          suggestion:
            'Use meaningful link text that describes the destination. Instead of "click here", use "View the accessibility guide".',
          code: line.trim(),
        });
      }

      // Check for missing ARIA landmarks
      if (
        /<div[^>]*className=["'][^"']*(header|nav|main|footer)/i.test(line) &&
        !/<div[^>]*role=/i.test(line)
      ) {
        issues.push({
          severity: "low",
          type: "Missing ARIA Landmark",
          file: file.name,
          line: lineNum,
          description: "Semantic section could benefit from ARIA landmark role",
          suggestion:
            "Consider using semantic HTML5 elements (<header>, <nav>, <main>, <footer>) or add appropriate ARIA roles.",
          code: line.trim(),
        });
      }
    });
  });

  return issues;
};

// AI-powered suggestions using Claude API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const getAISuggestions = async (issues, files) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("Gemini API key missing – using fallback");
      return generateFallbackSuggestions(issues);
    }

    const summary = {
      total: issues.length,
      critical: issues.filter((i) => i.severity === "critical").length,
      high: issues.filter((i) => i.severity === "high").length,
      medium: issues.filter((i) => i.severity === "medium").length,
      low: issues.filter((i) => i.severity === "low").length,
      issueTypes: [...new Set(issues.map((i) => i.type))],
      sampleIssues: issues.slice(0, 6),
    };

    const prompt = `
You are a WCAG 2.1 AA accessibility expert.

Analyze the detected issues and provide actionable guidance.

Summary:
- Total Issues: ${summary.total}
- Critical: ${summary.critical}
- High: ${summary.high}
- Medium: ${summary.medium}
- Low: ${summary.low}

Issue Types:
${summary.issueTypes.join(", ")}

Sample Issues:
${JSON.stringify(summary.sampleIssues, null, 2)}

Return:
1. Overall accessibility health (2–3 sentences)
2. Top 3 blockers and why they matter
3. Quick fixes developers can apply today
4. Long-term accessibility strategy
5. WCAG principles impacted (Perceivable, Operable, Understandable, Robust)

Tone: clear, friendly, professional.
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return generateFallbackSuggestions(issues);
  }
};

// Generate intelligent fallback suggestions without AI
const generateFallbackSuggestions = (issues) => {
  const summary = {
    critical: issues.filter((i) => i.severity === "critical").length,
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
    total: issues.length,
  };

  const issueTypes = [...new Set(issues.map((i) => i.type))];

  let suggestions = `## 📊 Accessibility Analysis Summary\n\n`;

  // Overall Assessment
  if (summary.total === 0) {
    suggestions += `**Great news!** No accessibility issues were detected in your project. Keep up the excellent work in maintaining accessible code!\n\n`;
  } else if (summary.critical > 0) {
    suggestions += `**Attention Required:** Your project has ${summary.critical} critical accessibility issue${summary.critical > 1 ? "s" : ""} that need immediate attention. These issues can prevent users with disabilities from accessing your content.\n\n`;
  } else if (summary.high > 0) {
    suggestions += `**Good Progress:** While there are no critical issues, you have ${summary.high} high-priority item${summary.high > 1 ? "s" : ""} that should be addressed soon to improve accessibility.\n\n`;
  } else {
    suggestions += `**Looking Good:** Your project has only minor accessibility improvements to make. You're on the right track!\n\n`;
  }

  // Priority Fixes
  suggestions += `### 🎯 Top Priority Fixes\n\n`;

  const criticalIssues = issues
    .filter((i) => i.severity === "critical")
    .slice(0, 3);
  const highIssues = issues.filter((i) => i.severity === "high").slice(0, 3);
  const topIssues = [...criticalIssues, ...highIssues].slice(0, 3);

  if (topIssues.length > 0) {
    topIssues.forEach((issue, idx) => {
      suggestions += `**${idx + 1}. ${issue.type}** (${issue.severity})\n`;
      suggestions += `   - Found in: ${issue.file}\n`;
      suggestions += `   - Fix: ${issue.suggestion}\n\n`;
    });
  } else {
    suggestions += `No critical or high-priority issues found. Focus on the medium and low-priority improvements below.\n\n`;
  }

  // Quick Wins
  suggestions += `### ⚡ Quick Wins (Easy Fixes with Big Impact)\n\n`;

  const quickWins = [];
  if (issueTypes.includes("Missing Alt Text")) {
    quickWins.push(
      `- **Add alt attributes to images**: This is one of the easiest and most impactful fixes. Every <img> tag should have an alt attribute describing the image.`,
    );
  }
  if (issueTypes.includes("Missing Form Label")) {
    quickWins.push(
      `- **Label your form inputs**: Wrap inputs with <label> tags or add aria-label attributes. This helps screen reader users understand what each field is for.`,
    );
  }
  if (issueTypes.includes("Missing Language Attribute")) {
    quickWins.push(
      `- **Add lang attribute to HTML**: Simply add lang="en" (or your language code) to your <html> tag. This helps screen readers pronounce content correctly.`,
    );
  }
  if (issueTypes.includes("Button Without Text")) {
    quickWins.push(
      `- **Add text to buttons**: Ensure all buttons have visible text or aria-label attributes so users know what the button does.`,
    );
  }

  if (quickWins.length > 0) {
    quickWins.forEach((win) => (suggestions += win + "\n"));
  } else {
    suggestions += `Great job! You've already addressed the most common quick-win items.\n`;
  }

  suggestions += `\n### 🏗️ Long-term Recommendations\n\n`;
  suggestions += `1. **Regular Testing**: Use tools like WAVE, axe DevTools, or Lighthouse to continuously check accessibility\n`;
  suggestions += `2. **Keyboard Navigation**: Ensure all interactive elements can be accessed and used with just a keyboard\n`;
  suggestions += `3. **Color Contrast**: Maintain at least 4.5:1 contrast ratio for normal text, 3:1 for large text\n`;
  suggestions += `4. **Semantic HTML**: Use proper HTML5 elements (<header>, <nav>, <main>, <footer>) instead of generic divs\n`;
  suggestions += `5. **ARIA Best Practices**: Only use ARIA when semantic HTML isn't sufficient\n\n`;

  suggestions += `### 📚 Resources\n\n`;
  suggestions += `- [WebAIM](https://webaim.org/) - Comprehensive accessibility guides\n`;
  suggestions += `- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Official standards\n`;
  suggestions += `- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility) - Practical tutorials\n\n`;

  suggestions += `*Keep making your web more accessible for everyone! 🌟*`;

  return suggestions;
};

export { analyzeAccessibility, getAISuggestions };
