import { redirect } from "next/navigation";

export default function TicketPage() {
  redirect("/tickets");
  // This will never render
  return null;
}
