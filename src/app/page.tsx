import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session && session.user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
  // This will never render
  return null;
}
