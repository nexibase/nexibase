export default [
  { model: 'Post',     policy: 'retain', field: 'authorId',
    reason: '공개 콘텐츠; User 조인으로 작성자 익명화' },
  { model: 'Comment',  policy: 'retain', field: 'authorId',
    reason: '공개 콘텐츠; User 조인으로 작성자 익명화' },
  { model: 'Reaction', policy: 'retain', field: 'userId',
    reason: '집계 좋아요 수에 영향; User 조인으로 익명화' },
]
