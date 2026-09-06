-- T-010: служебный пользователь для загрузки пакетов до появления auth (T-040).
-- Идемпотентная сидировка: upload-роут ссылается на него по фиксированному UUID.

INSERT INTO users (id, email, display_name, password_hash)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'system@local',
    'System (pre-auth uploader)',
    'not-a-login-password-hash'
)
ON CONFLICT (email) DO NOTHING;
