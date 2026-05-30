import { redirect } from "next/navigation";

export default function AdminProfileRedirect() {
  redirect("/dashboard/admin");
}
