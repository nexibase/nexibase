-- 쿠키 정책 푸터 메뉴 추가.
--
-- 쿠키 동의 철회 경로가 "푸터의 쿠키 정책 링크 → 정책 페이지의 설정 버튼"이므로,
-- 이 메뉴 항목이 없으면 기존 사이트에서는 방문자가 동의를 철회할 수단이 없다.
-- 신규 설치는 install seed가 넣으므로 여기서는 기존 설치만 대상으로 한다.
--
-- groupName은 기존 정책 메뉴가 쓰는 값을 그대로 따라간다 (한국어 설치는 '정책',
-- 영어 설치는 'Policies'). label도 그에 맞춘다. 이미 있으면 넣지 않는다.
INSERT INTO `menus` (`position`, `groupName`, `label`, `url`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`)
SELECT
    'footer',
    existing.`groupName`,
    CASE WHEN existing.`groupName` = '정책' THEN '쿠키 정책' ELSE 'Cookie Policy' END,
    '/policies/cookie',
    COALESCE(MAX(sibling.`sortOrder`), 1) + 1,
    1,
    NOW(3),
    NOW(3)
FROM `menus` AS existing
LEFT JOIN `menus` AS sibling
    ON sibling.`position` = 'footer' AND sibling.`groupName` = existing.`groupName`
WHERE existing.`position` = 'footer'
  AND existing.`url` = '/policies/privacy'
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM `menus`) AS m
      WHERE m.`position` = 'footer' AND m.`url` = '/policies/cookie'
  )
GROUP BY existing.`groupName`
LIMIT 1;
