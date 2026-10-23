const DASHBOARD_PROXY = "/api/dashboard";

export class DashboardApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "DashboardApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${DASHBOARD_PROXY}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    cache: options.cache ?? "no-store",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Dashboard API error ${res.status}`;
    let code: string | undefined;

    try {
      const parsed = JSON.parse(body) as {
        error?: string;
        message?: string;
      };
      code = parsed.error;
      if (parsed.message) {
        message = parsed.message;
      } else if (parsed.error) {
        message = parsed.error;
      }
    } catch {
      if (body) {
        message = body;
      }
    }

    throw new DashboardApiError(message, res.status, code);
  }

  return res.json();
}
