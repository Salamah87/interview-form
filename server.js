const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "submissions.jsonl");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8"
};

fs.mkdirSync(DATA_DIR, { recursive: true });

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function readSubmissions() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return fs.readFileSync(DATA_FILE, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function cleanText(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function cleanScore(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5 ? score : null;
}

function normalizeSubmission(input) {
  const criteria = Array.isArray(input.criteria) ? input.criteria : [];
  const cleanedCriteria = criteria.slice(0, 6).map(item => ({
    name: cleanText(item.name, 120),
    score: cleanScore(item.score),
    notes: cleanText(item.notes)
  }));
  const totalScore = cleanedCriteria.reduce((sum, item) => sum + (item.score || 0), 0);

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    candidateName: cleanText(input.candidateName, 160),
    positionApplied: cleanText(input.positionApplied, 160),
    department: cleanText(input.department, 120),
    interviewDate: cleanText(input.interviewDate, 40),
    interviewType: cleanText(input.interviewType, 120),
    interviewerName: cleanText(input.interviewerName, 160),
    interviewerTitle: cleanText(input.interviewerTitle, 160),
    criteria: cleanedCriteria,
    totalScore,
    recommendation: cleanText(input.recommendation, 80),
    comments: cleanText(input.comments),
    strengths: cleanText(input.strengths),
    developmentAreas: cleanText(input.developmentAreas)
  };
}

function validateSubmission(submission) {
  const missing = [];
  if (!submission.candidateName) missing.push("candidateName");
  if (!submission.positionApplied) missing.push("positionApplied");
  if (!submission.interviewerName) missing.push("interviewerName");
  if (submission.criteria.some(item => item.score === null)) missing.push("criteria scores");
  if (!submission.recommendation) missing.push("recommendation");
  return missing;
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const headers = [
    "Created At", "Candidate Name", "Position", "Department", "Interview Date",
    "Interview Type", "Interviewer", "Interviewer Title", "Total Score",
    "Recommendation", "Talent & Attitude", "Professional Knowledge",
    "Technical Skills", "Education & Qualifications", "Work Experience",
    "Communication & Presence", "Comments", "Strengths", "Areas for Development"
  ];
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    const scores = row.criteria.map(item => item.score || "");
    lines.push([
      row.createdAt, row.candidateName, row.positionApplied, row.department,
      row.interviewDate, row.interviewType, row.interviewerName,
      row.interviewerTitle, row.totalScore, row.recommendation,
      ...scores, row.comments, row.strengths, row.developmentAreas
    ].map(csvCell).join(","));
  }
  return "\uFEFF" + lines.join("\n");
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  }

  const ext = path.extname(filePath).toLowerCase();
  send(res, 200, fs.readFileSync(filePath), MIME[ext] || "application/octet-stream");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/submissions") {
      const body = await readBody(req);
      const submission = normalizeSubmission(JSON.parse(body || "{}"));
      const missing = validateSubmission(submission);
      if (missing.length) {
        return send(res, 400, JSON.stringify({ ok: false, message: "Missing required fields", missing }));
      }
      fs.appendFileSync(DATA_FILE, JSON.stringify(submission) + "\n", "utf8");
      return send(res, 201, JSON.stringify({ ok: true, id: submission.id, totalScore: submission.totalScore }));
    }

    if (req.method === "GET" && url.pathname === "/api/submissions") {
      return send(res, 200, JSON.stringify(readSubmissions().reverse()));
    }

    if (req.method === "GET" && url.pathname === "/export.csv") {
      return send(res, 200, toCsv(readSubmissions()), MIME[".csv"]);
    }

    serveStatic(req, res);
  } catch (error) {
    send(res, 500, JSON.stringify({ ok: false, message: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Interview form server running at http://localhost:${PORT}`);
});
