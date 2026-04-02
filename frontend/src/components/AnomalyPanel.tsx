"use client";

interface LogEntry {
  id: string;
  lineNumber: number;
  timestamp: string | null;
  sourceIp: string | null;
  method: string | null;
  url: string | null;
  statusCode: number | null;
  rawLine: string;
  isAnomaly: boolean;
  anomalyReason: string | null;
  anomalyScore: number | null;
}

interface Props {
  anomalies: LogEntry[];
}

export default function AnomalyPanel({ anomalies }: Props) {
  if (anomalies.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-green-400 text-4xl mb-3">&#10003;</div>
        <p className="text-gray-300 font-medium">No anomalies detected</p>
        <p className="text-gray-500 text-sm mt-1">
          All log entries appear normal
        </p>
      </div>
    );
  }

  const scoreColor = (score: number) => {
    if (score >= 0.8) return "text-red-400 bg-red-500/20";
    if (score >= 0.6) return "text-orange-400 bg-orange-500/20";
    if (score >= 0.4) return "text-yellow-400 bg-yellow-500/20";
    return "text-blue-400 bg-blue-500/20";
  };

  const scoreLabel = (score: number) => {
    if (score >= 0.8) return "High Confidence";
    if (score >= 0.6) return "Medium Confidence";
    if (score >= 0.4) return "Low Confidence";
    return "Informational";
  };

  return (
    <div className="space-y-4">
      <div className="card bg-red-500/5 border-red-500/20">
        <p className="text-red-400 font-medium">
          {anomalies.length} anomalous {anomalies.length === 1 ? "entry" : "entries"} detected
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Entries below were flagged by AI analysis as potentially suspicious.
          Each includes an explanation and confidence score.
        </p>
      </div>

      {anomalies.map((entry) => (
        <div
          key={entry.id}
          className="card border-l-4 border-l-red-500/50"
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-mono">
                Line {entry.lineNumber}
              </span>
              {entry.statusCode && (
                <span
                  className={`text-xs font-mono font-bold ${
                    entry.statusCode >= 500
                      ? "text-red-400"
                      : entry.statusCode >= 400
                        ? "text-yellow-400"
                        : "text-green-400"
                  }`}
                >
                  HTTP {entry.statusCode}
                </span>
              )}
              <span className="text-xs text-gray-500">
                {entry.method} {entry.sourceIp}
              </span>
            </div>

            {/* Confidence Score */}
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${scoreColor(entry.anomalyScore || 0)}`}
              >
                {Math.round((entry.anomalyScore || 0) * 100)}% — {scoreLabel(entry.anomalyScore || 0)}
              </span>
            </div>
          </div>

          {/* Anomaly Reason */}
          <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
            <p className="text-sm text-gray-300">
              <span className="text-red-400 font-medium">Why flagged: </span>
              {entry.anomalyReason}
            </p>
          </div>

          {/* Raw log line */}
          <div className="bg-gray-950 rounded-lg p-3 overflow-x-auto">
            <code className="text-xs text-gray-400 font-mono whitespace-nowrap">
              {entry.rawLine}
            </code>
          </div>

          {/* Timestamp */}
          {entry.timestamp && (
            <p className="text-xs text-gray-500 mt-2">
              {new Date(entry.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
