/**
 * Log Parser for Nginx/Apache Combined Log Format
 *
 * Parses logs in the format:
 * 192.168.1.1 - user [10/Oct/2023:13:55:36 +0000] "GET /api/users HTTP/1.1" 200 2326 "https://ref.com" "Mozilla/5.0..."
 *
 * AI Usage: This parser is rule-based (no AI). AI is used in analyzer.ts for
 * threat detection and anomaly analysis after parsing.
 */

export interface ParsedLogEntry {
  lineNumber: number;
  timestamp: Date | null;
  sourceIp: string;
  method: string;
  url: string;
  statusCode: number;
  bytesSent: number;
  userAgent: string;
  responseTime: number | null;
  rawLine: string;
}

// Combined Log Format regex
const LOG_REGEX =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"\s*(\d+\.?\d*)?/;

// Common Log Format (simpler)
const SIMPLE_LOG_REGEX =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d+)\s+(\d+)/;

function parseTimestamp(raw: string): Date | null {
  try {
    // Format: 10/Oct/2023:13:55:36 +0000
    const cleaned = raw
      .replace(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})/, "$2 $1 $3 $4 $5");
    const date = new Date(cleaned);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function parseLogLine(
  line: string,
  lineNumber: number
): ParsedLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  let match = trimmed.match(LOG_REGEX);
  let userAgent = "";
  let responseTime: number | null = null;

  if (match) {
    userAgent = match[8] || "";
    responseTime = match[9] ? parseFloat(match[9]) : null;
  } else {
    match = trimmed.match(SIMPLE_LOG_REGEX);
    if (!match) return null;
  }

  return {
    lineNumber,
    timestamp: parseTimestamp(match[2]),
    sourceIp: match[1],
    method: match[3],
    url: match[4],
    statusCode: parseInt(match[5], 10),
    bytesSent: parseInt(match[6], 10),
    userAgent,
    responseTime,
    rawLine: trimmed,
  };
}

export function parseLogFile(content: string): ParsedLogEntry[] {
  const lines = content.split("\n");
  const entries: ParsedLogEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const entry = parseLogLine(lines[i], i + 1);
    if (entry) entries.push(entry);
  }

  return entries;
}

/** Compute basic statistics from parsed entries (rule-based, no AI) */
export function computeStats(entries: ParsedLogEntry[]) {
  const ipCounts: Record<string, number> = {};
  const statusCounts = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  const urlCounts: Record<string, number> = {};
  const methodCounts: Record<string, number> = {};

  for (const entry of entries) {
    // IP counts
    ipCounts[entry.sourceIp] = (ipCounts[entry.sourceIp] || 0) + 1;

    // Status breakdown
    const statusGroup = `${Math.floor(entry.statusCode / 100)}xx` as keyof typeof statusCounts;
    if (statusGroup in statusCounts) {
      statusCounts[statusGroup]++;
    }

    // URL counts
    urlCounts[entry.url] = (urlCounts[entry.url] || 0) + 1;

    // Method counts
    methodCounts[entry.method] = (methodCounts[entry.method] || 0) + 1;
  }

  const topIps = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  const topUrls = Object.entries(urlCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  return { ipCounts, statusCounts, topIps, topUrls, methodCounts };
}
