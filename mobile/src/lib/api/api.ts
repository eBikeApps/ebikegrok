import { fetch } from "expo/fetch";
import { authClient } from "../auth/auth-client";

const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;

// IMPORTANT: This sets the cookies/auth token in the headers
const request = async <T>(
  url: string,
  options: { method?: string; body?: string } = {}
): Promise<T> => {
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Cookie: authClient.getCookie(),
    },
  });
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    let errData: any = {};
    try {
      errData = await response.json();
      if (errData?.message) message = errData.message;
      else if (typeof errData?.error === "string") message = errData.error;
      else if (Array.isArray(errData?.error)) {
        const first = errData.error[0];
        if (first?.message) message = first.message;
      }
    } catch {}
    const err = new Error(message);
    (err as any).status = response.status;
    (err as any).data = errData;
    throw err;
  }
  return response.json();
};

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: any) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: any) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
  patch: <T>(url: string, body: any) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
};
