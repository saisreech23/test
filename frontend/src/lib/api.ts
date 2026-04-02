const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function apiFetch(path: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    throw new Error("Authentication required");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// Auth
export const login = (email: string, password: string) =>
  apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const register = (email: string, password: string, name: string) =>
  apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });

export const getMe = () => apiFetch("/api/auth/me");

// Logs
export const uploadLogFile = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiFetch("/api/logs/upload", { method: "POST", body: form });
};

export const getUploads = () => apiFetch("/api/logs/uploads");

export const getUpload = (id: string) => apiFetch(`/api/logs/uploads/${id}`);

export const getLogEntries = (
  id: string,
  page = 1,
  limit = 50,
  anomaliesOnly = false
) =>
  apiFetch(
    `/api/logs/uploads/${id}/entries?page=${page}&limit=${limit}&anomalies=${anomaliesOnly}`
  );
