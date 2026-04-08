const DEFAULT_API_URL = "https://bitrix.somosahub.us";

export function getApiUrl(): string {
  return process.env.HUB_BITRIX_API_URL || DEFAULT_API_URL;
}

export function getApiKey(): string | null {
  return process.env.HUB_BITRIX_API_KEY || null;
}

async function request(method: string, path: string, body?: unknown): Promise<any> {
  const apiUrl = getApiUrl();
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("HUB_BITRIX_API_KEY environment variable is required");

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function call(method: string, params?: Record<string, unknown>) {
  return request("POST", "/api/call", { method, params });
}

export async function callAll(method: string, params?: Record<string, unknown>) {
  return request("POST", "/api/call/all", { method, params });
}

export async function listEntities() {
  return request("GET", "/api/entities");
}

export async function getApprovalStatus(id: string) {
  return request("GET", `/api/approval/${id}`);
}

export async function healthCheck() {
  const response = await fetch(`${getApiUrl()}/api/health`);
  return response.json();
}
