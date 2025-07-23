import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/tickets");
  // This will never render
  return null;
} 