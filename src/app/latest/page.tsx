import { redirect } from "next/navigation"

export default function Page() {
  redirect("/posts/latest")
}
