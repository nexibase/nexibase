-- The application feature and its installer defaults have been removed.
-- Keep applied migration files and historical consent_logs records intact.
DELETE FROM `settings` WHERE LEFT(`key`, 8) = 'consent_';
DELETE FROM `menus` WHERE `url` = '/policies/cookie';
DELETE FROM `policies` WHERE `slug` = 'cookie';
