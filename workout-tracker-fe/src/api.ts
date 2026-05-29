import axios from "axios";

// In dev, Vite proxies /api → localhost:47832.
// In production, VITE_API_URL is set to the deployed backend origin.
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

export const api = axios.create({ baseURL: BASE, withCredentials: true });

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export async function getSession(): Promise<{ user: User; token: string } | null> {
  try {
    const res = await api.get("/auth/get-session");
    if (!res.data?.user) return null;
    return { user: res.data.user, token: res.data.session?.token ?? "" };
  } catch {
    return null;
  }
}

export async function signOut() {
  await api.post("/auth/sign-out");
}
