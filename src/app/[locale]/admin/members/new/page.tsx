import { redirect } from "next/navigation"

export default function NewMemberPage() {
  redirect("/admin/users?new=1")
}
