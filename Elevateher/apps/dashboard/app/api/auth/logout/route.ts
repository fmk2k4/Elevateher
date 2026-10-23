import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  response.cookies.delete("dashboard_token");
  response.cookies.delete("dashboard_refresh_token");
  
  return response;
}
