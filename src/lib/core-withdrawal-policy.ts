// Core (non-plugin) models that reference User.id. Treated by the validator as
// a pseudo-plugin named 'core'. Edit this file when core schema adds or removes
// any User-referencing model.

export default [
  { model: 'BoardDailyUsage', policy: 'delete', reason: '일일 게시판 등록 횟수; 탈퇴 시 삭제' },
  { model: 'FaqView', policy: 'retain', field: 'userId', reason: 'FAQ 조회 집계 보존; 탈퇴 사용자는 User 조인으로 익명화' },
  { model: 'FaqFeedback', policy: 'retain', field: 'userId', reason: 'FAQ 평가 집계 보존; 탈퇴 사용자는 User 조인으로 익명화' },
  { model: 'UserAddress',            policy: 'delete' },
  { model: 'Notification',           policy: 'delete' },
  { model: 'NotificationPreference', policy: 'delete' },
  { model: 'Account',                policy: 'delete', reason: 'OAuth 연동 해제를 위해 Phase 1 에서 즉시 삭제; Phase 2 재실행 시 idempotent' },
  { model: 'Conversation',           policy: 'retain', reason: '상대방의 대화 기록 보존; 탈퇴 사용자는 User 조인으로 "탈퇴한회원_xxxxxx" 로 표시. 다중 FK 모델(user1Id/user2Id) 이라 미리보기 카운트는 생략, Message 카운트가 활동 지표 역할.' },
  { model: 'Message',                policy: 'retain', field: 'senderId', reason: '대화 기록 보존; 발신자는 User 조인으로 익명화' },
  { model: 'WithdrawalJob',          policy: 'retain', reason: '탈퇴 감사 기록 자체이므로 보존이 맞음' },
  // Core board activity keeps the existing retention and anonymization policy.
  { model: 'Post',     policy: 'retain', field: 'authorId',
    reason: '공개 콘텐츠; User 조인으로 작성자 익명화' },
  { model: 'Comment',  policy: 'retain', field: 'authorId',
    reason: '공개 콘텐츠; User 조인으로 작성자 익명화' },
  { model: 'Reaction', policy: 'retain', field: 'userId',
    reason: '집계 좋아요 수에 영향; User 조인으로 익명화' },
]
