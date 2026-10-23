import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  return proxyJsonToBackend(request, "/admin/summary");
}
