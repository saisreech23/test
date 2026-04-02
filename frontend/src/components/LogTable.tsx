"use client";

interface LogEntry {
  id: string;
  lineNumber: number;
  timestamp: string | null;
  sourceIp: string | null;
  method: string | null;
  url: string | null;
  statusCode: number | null;
  bytesSent: number | null;
  rawLine: string;
  isAnomaly: boolean;
  anomalyReason: string | null;
  anomalyScore: number | null;
}

interface Props {
  entries: LogEntry[];
}

export default function LogTable({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-8">No entries</p>;
  }

  const statusColor = (code: number | null) => {
    if (!code) return "text-gray-400";
    if (code < 300) return "text-green-400";
    if (code < 400) return "text-blue-400";
    if (code < 500) return "text-yellow-400";
    return "text-red-400";
  };

  const methodColor = (method: string | null) => {
    const colors: Record<string, string> = {
      GET: "text-green-400",
      POST: "text-blue-400",
      PUT: "text-yellow-400",
      DELETE: "text-red-400",
      PATCH: "text-purple-400",
    };
    return colors[method || ""] || "text-gray-400";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
            <th className="pb-2 pr-3">#</th>
            <th className="pb-2 pr-3">Time</th>
            <th className="pb-2 pr-3">Source IP</th>
            <th className="pb-2 pr-3">Method</th>
            <th className="pb-2 pr-3">URL</th>
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2 pr-3">Bytes</th>
            <th className="pb-2">Anomaly</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className={`border-b border-gray-800/50 ${
                entry.isAnomaly
                  ? "bg-red-500/5 hover:bg-red-500/10"
                  : "hover:bg-gray-800/30"
              }`}
              title={entry.isAnomaly ? entry.anomalyReason || "" : ""}
            >
              <td className="py-2 pr-3 text-gray-500 font-mono">
                {entry.lineNumber}
              </td>
              <td className="py-2 pr-3 text-gray-400 font-mono text-xs whitespace-nowrap">
                {entry.timestamp
                  ? new Date(entry.timestamp).toLocaleTimeString()
                  : "-"}
              </td>
              <td className="py-2 pr-3 font-mono">{entry.sourceIp || "-"}</td>
              <td className={`py-2 pr-3 font-mono font-bold ${methodColor(entry.method)}`}>
                {entry.method || "-"}
              </td>
              <td className="py-2 pr-3 font-mono max-w-xs truncate">
                {entry.url || "-"}
              </td>
              <td className={`py-2 pr-3 font-mono font-bold ${statusColor(entry.statusCode)}`}>
                {entry.statusCode || "-"}
              </td>
              <td className="py-2 pr-3 text-gray-400">
                {entry.bytesSent != null
                  ? entry.bytesSent > 1024
                    ? `${(entry.bytesSent / 1024).toFixed(1)}K`
                    : entry.bytesSent
                  : "-"}
              </td>
              <td className="py-2">
                {entry.isAnomaly && (
                  <span className="badge-critical">
                    {Math.round((entry.anomalyScore || 0) * 100)}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
