import { FaqPage, faqPageMetadata } from '@/features/faqs/components/FaqPage'

export async function generateMetadata() {
  return faqPageMetadata()
}

export default function Page() {
  return <FaqPage />
}
