export default [
  { model: 'Poll',     policy: 'retain',
    reason: 'Public content; anonymized via User join' },
  { model: 'PollVote', policy: 'retain', field: 'userId',
    reason: 'Affects aggregate vote counts; voter rendered as anonymized User via join' },
]
