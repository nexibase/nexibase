import { redirect } from "next/navigation"

export default function WishlistPage() {
  redirect('/shop/mypage?tab=wishlist')
}
