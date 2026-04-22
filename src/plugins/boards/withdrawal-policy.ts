export default [
  { model: 'Post',     policy: 'retain',
    reason: 'Public content; anonymized via User join' },
  { model: 'Comment',  policy: 'retain',
    reason: 'Public content; anonymized via User join' },
  { model: 'Reaction', policy: 'retain', field: 'userId',
    reason: 'Affects aggregate like counts; anonymized via User join' },
]
