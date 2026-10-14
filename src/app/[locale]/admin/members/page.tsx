import { redirect } from "next/navigation"

// Compatibility URL for the former Gnuboard member administration.
export default function MembersPage() {
  redirect("/admin/users")
}
