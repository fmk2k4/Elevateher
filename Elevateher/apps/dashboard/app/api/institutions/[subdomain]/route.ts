import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getDashboardConfig() {
  const apiBase =
    process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const token = process.env.DASHBOARD_SERVICE_TOKEN || "";
  const jwtParts = token.split(".");

  if (!token || jwtParts.length !== 3) {
    return null;
  }

  return { apiBase, token };
}

const SUBDOMAIN_TO_INSTITUTION: Record<
  string,
  { id: string; name: string; country: string; type: string; subdomain: string }
> = {
  inti: {
    id: "inti-university-malaysia",
    name: "INTI International University",
    country: "MY",
    type: "university",
    subdomain: "inti-university-malaysia",
  },
  "inti-university-malaysia": {
    id: "inti-university-malaysia",
    name: "INTI International University",
    country: "MY",
    type: "university",
    subdomain: "inti-university-malaysia",
  },
  nyp: {
    id: "nyp",
    name: "Nanyang Polytechnic",
    country: "SG",
    type: "polytechnic",
    subdomain: "nyp",
  },
  "nyp-singapore": {
    id: "nyp",
    name: "Nanyang Polytechnic",
    country: "SG",
    type: "polytechnic",
    subdomain: "nyp",
  },
  binus: {
    id: "binus",
    name: "BINUS University",
    country: "ID",
    type: "university",
    subdomain: "binus",
  },
  "binus-indonesia": {
    id: "binus",
    name: "BINUS University",
    country: "ID",
    type: "university",
    subdomain: "binus",
  },
};

function normalizeSubdomain(subdomain: string): string {
  return subdomain.trim().toLowerCase();
}

async function getInstitutionMetadata(
  subdomain: string,
): Promise<{
  id: string;
  name: string;
  country: string;
  type: string;
  subdomain: string;
} | null> {
  const normalizedSubdomain = normalizeSubdomain(subdomain);
  const config = getDashboardConfig();
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  if (!config) {
    if (!isDemoMode) {
      throw new Error("institution_service_unavailable: Dashboard token or API URL missing");
    }
    return SUBDOMAIN_TO_INSTITUTION[normalizedSubdomain] ?? null;
  }

  const { apiBase, token } = config;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(
      `${apiBase.replace(/\/$/, "")}/dashboard/${normalizedSubdomain}/stats`,
      { method: "GET", headers, cache: "no-store" },
    );
    if (!res.ok) {
      if (!isDemoMode) {
        throw new Error(`institution_service_unavailable: upstream returned ${res.status}`);
      }
      return null;
    }
    const data = (await res.json()) as Record<string, unknown>;
    const fallback = SUBDOMAIN_TO_INSTITUTION[normalizedSubdomain] ?? {
      id: normalizedSubdomain,
      name: normalizedSubdomain,
      country: "",
      type: "",
      subdomain: normalizedSubdomain,
    };
    return {
      id: (data.institution_id as string) ?? fallback.id,
      name: (data.name as string) ?? fallback.name,
      country: (data.country as string) ?? fallback.country,
      type: (data.type as string) ?? fallback.type,
      subdomain: fallback.subdomain,
    };
  } catch (err) {
    if (!isDemoMode) {
      throw err;
    }
    return SUBDOMAIN_TO_INSTITUTION[normalizedSubdomain] ?? null;
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await ctx.params;
  try {
    const institution = await getInstitutionMetadata(subdomain);
    if (!institution) {
      return NextResponse.json(
        { error: "institution_not_found", subdomain },
        { status: 404 },
      );
    }
    return NextResponse.json(institution, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "institution_service_unavailable", message: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
