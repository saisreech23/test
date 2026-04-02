/**
 * AI-Powered Log Analyzer using Anthropic Claude API
 *
 * AI Usage Documentation:
 * -----------------------
 * This module uses the Anthropic Claude API (claude-sonnet-4-20250514) for TWO purposes:
 *
 * 1. **Anomaly Detection** (detectAnomalies function):
 *    - Rule-based pre-filtering identifies suspicious entries (high request rates,
 *      unusual status codes, known attack patterns, odd hours, large responses).
 *    - Claude then analyzes these candidates to confirm/refine anomalies,
 *      provide human-readable explanations, and assign confidence scores.
 *
 * 2. **Summary & Timeline Generation** (generateAnalysisSummary function):
 *    - Claude receives the parsed log statistics and anomaly data.
 *    - It produces: a natural-language summary, a chronological timeline of
 *      key events, threat level assessment, and key findings for SOC analysts.
 *
 * The AI acts as an expert SOC analyst, interpreting patterns that would be
 * difficult to capture with rules alone (e.g., subtle attack chains, context
 * around why a pattern is suspicious).
 */

import Anthropic from "@anthropic-ai/sdk";
import { ParsedLogEntry, computeStats } from "./parser";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AnomalyResult {
  lineNumber: number;
  reason: string;
  score: number; // 0.0 - 1.0 confidence
}

interface TimelineEvent {
  time: string;
  event: string;
  severity: "info" | "warning" | "critical";
}

interface AnalysisResult {
  summary: string;
  timeline: TimelineEvent[];
  threatLevel: string;
  keyFindings: string[];
  anomalies: AnomalyResult[];
}

/**
 * Rule-based pre-filter: flags candidate anomalous entries before sending to AI.
 * This reduces token usage by only sending suspicious entries to Claude.
 */
function preFilterAnomalies(entries: ParsedLogEntry[]): {
  candidates: { entry: ParsedLogEntry; reasons: string[] }[];
} {
  const ipCounts: Record<string, number> = {};
  const ipTimeWindows: Record<string, number[]> = {};
  const candidates: { entry: ParsedLogEntry; reasons: string[] }[] = [];

  // Build IP frequency maps
  for (const entry of entries) {
    ipCounts[entry.sourceIp] = (ipCounts[entry.sourceIp] || 0) + 1;
    if (entry.timestamp) {
      if (!ipTimeWindows[entry.sourceIp]) ipTimeWindows[entry.sourceIp] = [];
      ipTimeWindows[entry.sourceIp].push(entry.timestamp.getTime());
    }
  }

  // Thresholds
  const avgRequestsPerIp =
    entries.length / Object.keys(ipCounts).length || 1;
  const highRateThreshold = Math.max(avgRequestsPerIp * 5, 50);

  // Attack patterns in URLs
  const attackPatterns = [
    /(\.\.\/)/, // path traversal
    /(union\s+select|or\s+1\s*=\s*1|drop\s+table)/i, // SQL injection
    /(<script|javascript:|onerror=)/i, // XSS
    /(\/etc\/passwd|\/proc\/|\/\.env|\.git\/)/i, // sensitive files
    /(cmd=|exec=|system\(|eval\()/i, // command injection
    /(wp-admin|wp-login|phpmyadmin|\.php)/i, // common scan targets
    /(\/admin|\/manager|\/console)/i, // admin panels
  ];

  for (const entry of entries) {
    const reasons: string[] = [];

    // High request rate from single IP
    if (ipCounts[entry.sourceIp] > highRateThreshold) {
      reasons.push(
        `High request volume: ${ipCounts[entry.sourceIp]} requests from this IP (avg: ${Math.round(avgRequestsPerIp)})`
      );
    }

    // Burst detection: many requests in short window
    if (entry.timestamp && ipTimeWindows[entry.sourceIp]) {
      const times = ipTimeWindows[entry.sourceIp];
      const entryTime = entry.timestamp.getTime();
      const windowMs = 60_000; // 1 minute
      const burstCount = times.filter(
        (t) => Math.abs(t - entryTime) < windowMs
      ).length;
      if (burstCount > 20) {
        reasons.push(
          `Burst detected: ${burstCount} requests within 1-minute window`
        );
      }
    }

    // Server errors (5xx)
    if (entry.statusCode >= 500) {
      reasons.push(`Server error: HTTP ${entry.statusCode}`);
    }

    // Client errors suggesting scanning (404, 403, 401)
    if ([401, 403].includes(entry.statusCode)) {
      reasons.push(
        `Access denied: HTTP ${entry.statusCode} — possible unauthorized access attempt`
      );
    }

    // Attack patterns in URL
    for (const pattern of attackPatterns) {
      if (pattern.test(entry.url)) {
        reasons.push(`Suspicious URL pattern: ${entry.url}`);
        break;
      }
    }

    // Unusual HTTP methods
    if (!["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].includes(entry.method)) {
      reasons.push(`Unusual HTTP method: ${entry.method}`);
    }

    // Very large response (potential data exfiltration)
    if (entry.bytesSent > 10_000_000) {
      reasons.push(
        `Large response: ${(entry.bytesSent / 1_000_000).toFixed(1)}MB — potential data exfiltration`
      );
    }

    // Odd hours (midnight to 5 AM)
    if (entry.timestamp) {
      const hour = entry.timestamp.getUTCHours();
      if (hour >= 0 && hour < 5) {
        reasons.push(`Off-hours activity: request at ${hour}:00 UTC`);
      }
    }

    if (reasons.length > 0) {
      candidates.push({ entry, reasons });
    }
  }

  return { candidates };
}

/**
 * Uses Claude AI to analyze candidate anomalies and provide expert assessment.
 * AI confirms or dismisses rule-based flags, adds context, and scores severity.
 */
async function detectAnomalies(
  entries: ParsedLogEntry[],
  stats: ReturnType<typeof computeStats>
): Promise<AnomalyResult[]> {
  const { candidates } = preFilterAnomalies(entries);

  if (candidates.length === 0) return [];

  // Limit to top 100 candidates to manage token usage
  const topCandidates = candidates.slice(0, 100);

  const candidatesSummary = topCandidates
    .map(
      (c, i) =>
        `[${i + 1}] Line ${c.entry.lineNumber}: ${c.entry.rawLine}\n   Pre-filter reasons: ${c.reasons.join("; ")}`
    )
    .join("\n\n");

  const contextInfo = `
Log file context:
- Total entries: ${entries.length}
- Unique IPs: ${Object.keys(stats.ipCounts).length}
- Status breakdown: ${JSON.stringify(stats.statusCounts)}
- Top IPs: ${stats.topIps.slice(0, 5).map((i) => `${i.ip} (${i.count} reqs)`).join(", ")}
  `;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are an expert SOC analyst reviewing pre-filtered anomaly candidates from web server access logs.

${contextInfo}

Below are ${topCandidates.length} candidate entries flagged by rule-based pre-filtering. For each, decide if it is a TRUE anomaly or a false positive. For true anomalies, provide:
1. A concise explanation suitable for a SOC analyst
2. A confidence score from 0.0 to 1.0

Respond ONLY with a JSON array. Each element: {"line": <lineNumber>, "anomaly": true/false, "reason": "<explanation>", "score": <0.0-1.0>}
Only include entries where anomaly is true.

Candidates:
${candidatesSummary}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      line: number;
      anomaly: boolean;
      reason: string;
      score: number;
    }>;

    return parsed
      .filter((r) => r.anomaly)
      .map((r) => ({
        lineNumber: r.line,
        reason: r.reason,
        score: Math.min(1, Math.max(0, r.score)),
      }));
  } catch (err) {
    console.error("AI anomaly detection failed, falling back to rules:", err);
    // Fallback: use rule-based results directly
    return topCandidates.map((c) => ({
      lineNumber: c.entry.lineNumber,
      reason: c.reasons[0],
      score: 0.6,
    }));
  }
}

/**
 * Uses Claude AI to generate a comprehensive analysis summary including
 * timeline, threat assessment, and key findings for SOC analysts.
 */
async function generateAnalysisSummary(
  entries: ParsedLogEntry[],
  stats: ReturnType<typeof computeStats>,
  anomalies: AnomalyResult[]
): Promise<Omit<AnalysisResult, "anomalies">> {
  const timeRange =
    entries.length > 0
      ? {
          start: entries.find((e) => e.timestamp)?.timestamp?.toISOString(),
          end: [...entries]
            .reverse()
            .find((e) => e.timestamp)
            ?.timestamp?.toISOString(),
        }
      : { start: "N/A", end: "N/A" };

  const anomalySummary = anomalies
    .slice(0, 20)
    .map((a) => `Line ${a.lineNumber} (score: ${a.score}): ${a.reason}`)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are an expert SOC analyst. Analyze these web server log statistics and produce a security report.

Log Overview:
- Time range: ${timeRange.start} to ${timeRange.end}
- Total entries: ${entries.length}
- Unique IPs: ${Object.keys(stats.ipCounts).length}
- Status breakdown: ${JSON.stringify(stats.statusCounts)}
- Top 10 IPs: ${JSON.stringify(stats.topIps)}
- Top 10 URLs: ${JSON.stringify(stats.topUrls)}
- HTTP methods: ${JSON.stringify(stats.methodCounts)}
- Anomalies detected: ${anomalies.length}

Anomaly details:
${anomalySummary || "None detected"}

Respond ONLY with JSON in this exact format:
{
  "summary": "<2-3 paragraph executive summary for SOC team>",
  "timeline": [{"time": "<ISO timestamp or time range>", "event": "<what happened>", "severity": "info|warning|critical"}],
  "threatLevel": "low|medium|high|critical",
  "keyFindings": ["<finding 1>", "<finding 2>", ...]
}

The timeline should capture the most significant security-relevant events in chronological order (5-15 events).
Key findings should be actionable insights a SOC analyst needs to know.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("AI summary generation failed, using fallback:", err);
    return {
      summary: `Analysis of ${entries.length} log entries from ${Object.keys(stats.ipCounts).length} unique IPs. ${anomalies.length} anomalies were detected. Status breakdown: ${stats.statusCounts["2xx"]} successful, ${stats.statusCounts["4xx"]} client errors, ${stats.statusCounts["5xx"]} server errors.`,
      timeline: [],
      threatLevel:
        anomalies.length > 10
          ? "high"
          : anomalies.length > 3
            ? "medium"
            : "low",
      keyFindings: [
        `${anomalies.length} anomalous entries detected`,
        `Top IP: ${stats.topIps[0]?.ip || "N/A"} with ${stats.topIps[0]?.count || 0} requests`,
        `${stats.statusCounts["5xx"]} server errors detected`,
      ],
    };
  }
}

/** Main analysis pipeline: parse stats -> detect anomalies -> generate summary */
export async function analyzeLogEntries(
  entries: ParsedLogEntry[]
): Promise<AnalysisResult> {
  const stats = computeStats(entries);
  const anomalies = await detectAnomalies(entries, stats);
  const summary = await generateAnalysisSummary(entries, stats, anomalies);

  return {
    ...summary,
    anomalies,
  };
}

export type { AnomalyResult, TimelineEvent, AnalysisResult };
