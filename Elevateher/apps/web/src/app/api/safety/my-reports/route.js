import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    return proxyJsonToBackend(request, "/safety/my-reports");
  } catch (err) {
    console.error("GET /api/safety/my-reports", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
