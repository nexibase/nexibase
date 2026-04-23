export default [
  { model: 'Poll',     policy: 'retain', field: 'authorId',
    reason: '공개 콘텐츠; User 조인으로 작성자 익명화' },
  { model: 'PollVote', policy: 'retain', field: 'userId',
    reason: '집계 투표 수에 영향; 투표자는 User 조인으로 익명화' },
]
