"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getUpload, getLogEntries } from "@/lib/api";
import Timeline from "@/components/Timeline";
import LogTable from "@/components/LogTable";
import AnomalyPanel from "@/components/AnomalyPanel";
import StatusChart from "@/components/StatusChart";

interface TimelineEvent {
  time: string;
  event: string;
  severity: "info" | "warning" | "critical";
}

interface Analysis {
  id: string;
  summary: string;
  timeline: TimelineEvent[];
  threatLevel: string;
  totalEntries: number;
  anomalyCount: number;
  topIps: { ip: string; count: number }[];
  statusBreakdown: Record<string, number>;
  keyFindings: string[];
}

interface Upload {
  id: string;
  originalName: string;
  size: number;
  status: string;
  createdAt: string;
  analysis: Analysis;
}

interface LogEntry {
  id: string;
  lineNumber: number;
  timestamp: string | null;
  sourceIp: string | null;
  method: string | null;
  url: string | null;
  statusCode: number | null;
  userAgent: string | null;
  bytesSent: number | null;
  rawLine: string;
  isAnomaly: boolean;
  anomalyReason: string | null;
  anomalyScore: number | null;
}

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const [upload, setUpload] = useState<Upload | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [anomalies, setAnomalies] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "logs" | "anomalies">("overview");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    const id = params.id as string;

    Promise.all([
      getUpload(id),
      getLogEntries(id, 1, 50),
      getLogEntries(id, 1, 50, true),
    ])
      .then(([uploadData, entriesData, anomalyData]) => {
        setUpload(uploadData.upload);
        setEntries(entriesData.entries);
        setTotalPages(entriesData.pagination.totalPages);
        setAnomalies(anomalyData.entries);
      })
      .catch(() => router.push("/dashboard"))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  const loadPage = async (p: number) => {
    setPage(p);
    const data = await getLogEntries(params.id as string, p, 50);
    setEntries(data.entries);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-400">Loading analysis...</div>
      </div>
    );
  }

  if (!upload?.analysis) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Analysis not found</div>
      </div>
    );
  }

  const { analysis } = upload;
  const threatColors: Record<string, string> = {
    critical: "text-red-400",
    high: "text-orange-400",
    medium: "text-yellow-400",
    low: "text-green-400",
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-400 hover:text-white transition-colors"
            >
              &larr; Back
            </button>
            <h1 className="text-xl font-bold">
              <span className="text-primary-500">Log</span>Sentry
            </h1>
          </div>
          <span className="text-sm text-gray-400">{upload.originalName}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <div className="text-2xl font-bold">
              {analysis.totalEntries.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Total Entries</div>
          </div>
          <div className="card text-center">
            <div
              className={`text-2xl font-bold ${threatColors[analysis.threatLevel]}`}
            >
              {analysis.threatLevel.toUpperCase()}
            </div>
            <div className="text-sm text-gray-400">Threat Level</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-red-400">
              {analysis.anomalyCount}
            </div>
            <div className="text-sm text-gray-400">Anomalies</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-primary-500">
              {analysis.topIps.length}
            </div>
            <div className="text-sm text-gray-400">Unique IPs (Top)</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
          {(["overview", "logs", "anomalies"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t === "overview"
                ? "Overview"
                : t === "logs"
                  ? "Log Entries"
                  : `Anomalies (${analysis.anomalyCount})`}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* AI Summary */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                AI Analysis Summary
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                  Claude AI
                </span>
              </h3>
              <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                {analysis.summary}
              </div>
            </div>

            {/* Key Findings */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-3">
                Key Findings for SOC Analyst
              </h3>
              <ul className="space-y-2">
                {analysis.keyFindings.map((finding: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-primary-500 mt-1 text-sm">&#9679;</span>
                    <span className="text-gray-300">{finding}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Timeline */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-3">Event Timeline</h3>
                <Timeline events={analysis.timeline} />
              </div>

              {/* Charts */}
              <div className="space-y-6">
                <div className="card">
                  <h3 className="text-lg font-semibold mb-3">
                    Status Code Distribution
                  </h3>
                  <StatusChart data={analysis.statusBreakdown} />
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold mb-3">Top Source IPs</h3>
                  <div className="space-y-2">
                    {analysis.topIps.map(
                      (ip: { ip: string; count: number }, i: number) => {
                        const maxCount = analysis.topIps[0]?.count || 1;
                        const pct = (ip.count / maxCount) * 100;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-sm text-gray-400 w-32 font-mono truncate">
                              {ip.ip}
                            </span>
                            <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-600 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-400 w-16 text-right">
                              {ip.count}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "logs" && (
          <div className="card">
            <LogTable entries={entries} />
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-800">
                <button
                  onClick={() => loadPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-sm"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => loadPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary text-sm"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "anomalies" && (
          <AnomalyPanel anomalies={anomalies} />
        )}
      </main>
    </div>
  );
}
