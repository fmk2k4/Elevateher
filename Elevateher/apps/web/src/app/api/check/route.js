import { proxyPublicToBackend } from "@/app/api/utils/backend";
export async function GET() {
  try {
    const res = await proxyPublicToBackend(
      new Request("http://localhost/check"),
      "/check"
    );
    return res;
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
