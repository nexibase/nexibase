# User Withdrawal — E2E Test Checklist

Run these steps on a fresh dev database (or a clean seeded state). Record pass/fail for each.

## Setup
- [ ] `npm run dev` starts without build errors (validates Tasks 6-7).
- [ ] Register a fresh user `test1@example.com` via the normal signup flow. Note the userId.

## Seed data as that user
- [ ] Create 2 posts in a board.
- [ ] Add 5 comments on other posts.
- [ ] Add 1 product review (if shop is enabled).
- [ ] Add 3 wishlist items.
- [ ] Add 2 shipping addresses.
- [ ] Place 1 completed order (for legal retention verification).
- [ ] Link an OAuth account (optional).

## Preview
- [ ] Navigate to `/mypage/account/withdraw`. All three sections show the expected counts.
- [ ] Select a reason radio; "기타" reveals textarea.

## Withdrawal
- [ ] Submit with wrong password → red error, no redirect.
- [ ] Submit with correct password → redirect to `/?withdrawn=1`.
- [ ] Within 5 seconds: refresh any page → session invalidated (redirected to login).

## DB verification (run against dev DB)
- [ ] `users` row for the test user: email is `deleted_*@deleted.local`, nickname `탈퇴한회원_*`, status `withdrawn`, deletedAt set, password/phone/image/provider/providerId all null.
- [ ] `accounts` for that userId: 0 rows.
- [ ] `wishlists` for that userId: 0 rows.
- [ ] `user_addresses` for that userId: 0 rows.
- [ ] `notifications` for that userId: 0 rows.
- [ ] `posts` for that userId (authorId): count unchanged.
- [ ] `comments` for that userId (authorId): count unchanged.
- [ ] `product_reviews` for that userId: count unchanged.
- [ ] `orders` for that userId: count unchanged, `ordererName`/`ordererEmail` original values preserved (legal retention).
- [ ] `withdrawal_jobs`: latest row for this userId has status `done`, completedAt set.

## Re-registration
- [ ] Sign up a new account with the same email `test1@example.com` → succeeds immediately.
- [ ] New account has a new userId.
- [ ] Mypage for the new account shows no posts/comments/reviews/orders from the previous account.
- [ ] Browse to any post formerly by the old user: author renders as `탈퇴한회원_xxxxxx`.

## Verification sweep
- [ ] `npm run cron:withdrawal-verify` exits 0 with `✓ No stale rows detected`.

## Admin audit
- [ ] As admin, `/admin/privacy/withdrawal-policy` loads. Policy table is populated. Latest job visible with status `done`.

## Failure path
- [ ] Simulate a Phase 2 failure: temporarily break one of the delete targets (e.g., rename a Prisma client accessor in `execute.ts` via a local patch). Repeat withdrawal for a different test user. Observe withdrawal_jobs row ends `failed` with lastError populated.
- [ ] Revert the patch. Click "재시도" in admin audit page. Job transitions to `done`.
