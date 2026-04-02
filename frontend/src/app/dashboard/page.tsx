"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getStoredUser, clearAuth } from "@/lib/auth";
import { getUploads, uploadLogFile } from "@/lib/api";
import FileUpload from "@/components/FileUpload";

interface Upload {
  id: string;
  originalName: string;
  size: number;
  status: string;
  createdAt: string;
  analysis?: {
    threatLevel: string;
    totalEntries: number;
    anomalyCount: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const user = getStoredUser();

  const fetchUploads = useCallback(async () => {
    try {
      const data = await getUploads();
      setUploads(data.uploads);
    } catch {
      setError("Failed to load uploads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    fetchUploads();
    // Poll for processing updates every 5s
    const interval = setInterval(fetchUploads, 5000);
    return () => clearInterval(interval);
  }, [router, fetchUploads]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      await uploadLogFile(file);
      await fetchUploads();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const threatBadge = (level?: string) => {
    const classes: Record<string, string> = {
      critical: "badge-critical",
      high: "badge-high",
      medium: "badge-medium",
      low: "badge-low",
    };
    return level ? (
      <span className={classes[level] || "badge-low"}>
        {level.toUpperCase()}
      </span>
    ) : null;
  };

  const statusBadge = (status: string) => {
    if (status === "completed")
      return <span className="text-green-400 text-sm">Completed</span>;
    if (status === "processing")
      return (
        <span className="text-yellow-400 text-sm animate-pulse">
          Processing...
        </span>
      );
    if (status === "failed")
      return <span className="text-red-400 text-sm">Failed</span>;
    return <span className="text-gray-400 text-sm">{status}</span>;
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">
            <span className="text-primary-500">Log</span>Sentry
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user?.name}</span>
            <button onClick={handleLogout} className="btn-secondary text-sm">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Upload Section */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold mb-4">Upload Log File</h2>
          <FileUpload onUpload={handleUpload} uploading={uploading} />
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
        </div>

        {/* Uploads List */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Analysis History</h2>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No uploads yet. Upload a log file to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-800">
                    <th className="pb-3 pr-4">File</th>
                    <th className="pb-3 pr-4">Size</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Threat Level</th>
                    <th className="pb-3 pr-4">Entries</th>
                    <th className="pb-3 pr-4">Anomalies</th>
                    <th className="pb-3">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
                      onClick={() =>
                        u.status === "completed" &&
                        router.push(`/analysis/${u.id}`)
                      }
                    >
                      <td className="py-3 pr-4 font-medium text-sm">
                        {u.originalName}
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-400">
                        {(u.size / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3 pr-4">{statusBadge(u.status)}</td>
                      <td className="py-3 pr-4">
                        {threatBadge(u.analysis?.threatLevel)}
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-400">
                        {u.analysis?.totalEntries?.toLocaleString() || "-"}
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        {u.analysis?.anomalyCount != null ? (
                          <span
                            className={
                              u.analysis.anomalyCount > 0
                                ? "text-red-400"
                                : "text-green-400"
                            }
                          >
                            {u.analysis.anomalyCount}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 text-sm text-gray-500">
                        {new Date(u.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
