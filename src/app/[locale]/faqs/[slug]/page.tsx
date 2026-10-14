import { FaqPage, faqPageMetadata } from '@/features/faqs/components/FaqPage'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  return faqPageMetadata((await params).slug)
}

export default async function Page({ params }: Props) {
  return <FaqPage slug={(await params).slug} />
}
