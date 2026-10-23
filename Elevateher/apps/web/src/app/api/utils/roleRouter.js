import { auth } from "@/auth";

export async function getRoleBasedPath(req, menteePathSuffix, mentorPathSuffix) {
  const session = await auth();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const role = session.user.role;
  if (role === "mentor") {
    return mentorPathSuffix;
  }
  return menteePathSuffix;
}
