import type { Metadata } from 'next'
import PollsPage from '@/plugins/polls/components/PollsPage'

export const metadata: Metadata = {
  title: 'Polls',
  description: 'Community polls — vote and see results',
}

export default function Page() {
  return <PollsPage />
}
