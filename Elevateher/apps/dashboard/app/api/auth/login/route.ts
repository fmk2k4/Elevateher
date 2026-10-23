import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body;

    const apiBase = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    
    // Call FastAPI login
    const loginRes = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifier, password }),
    });

    if (!loginRes.ok) {
      const errorData = await loginRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Invalid credentials" },
        { status: loginRes.status }
      );
    }

    const data = await loginRes.json();
    
    // Create response and set cookie
    const response = NextResponse.json({ 
      success: true, 
      user_id: data.user_id, 
      role: data.role, 
      institution_id: data.institution_id,
      subdomain: data.subdomain 
    });
    
    response.cookies.set("dashboard_token", data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: data.expires_in || 3600,
      path: "/",
    });
    
    if (data.refresh_token) {
      response.cookies.set("dashboard_refresh_token", data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
