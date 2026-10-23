export async function getRoleBasedPath(req, menteePathSuffix, mentorPathSuffix) {
  // Decode the JWT payload (no verification needed — FastAPI verifies the signature)
  // to determine the user's role for routing to the correct backend path.
  let role = "mentee";
  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payloadBase64 = token.split(".")[1];
      const payload = JSON.parse(atob(payloadBase64));
      role = payload.role || "mentee";
    } catch {
      role = "mentee";
    }
  }

  if (role === "mentor") {
    return mentorPathSuffix;
  }
  return menteePathSuffix;
}
