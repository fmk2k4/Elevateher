import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const params = new URLSearchParams();
    for (const key of ["track", "language", "limit"]) {
      const value = url.searchParams.get(key);
      if (value) {
        params.set(key, value);
      }
    }
    const path = params.toString() ? `/mentor/list?${params.toString()}` : "/mentor/list";
    return proxyJsonToBackend(request, path);
  } catch (err) {
    console.error("GET /api/mentor/list", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
