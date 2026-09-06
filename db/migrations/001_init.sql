-- scorm-inspector: базовая схема (T-002, RQ-015/RQ-016)
-- Без auth-логики: таблица users — просто хранение аккаунтов (auth = T-040).

CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        TEXT NOT NULL UNIQUE,
    display_name TEXT,
    password_hash TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE packages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    file_sha256 TEXT NOT NULL,
    size_bytes  BIGINT NOT NULL,
    scorm_version TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Содержимое пакета в БД не хранится и в git не заливается (C-02/C-03):
-- пакеты лежат на диске вне репозитория, здесь только метаданные и находки.
ALTER TABLE packages ADD CONSTRAINT packages_no_content CHECK (size_bytes >= 0);

CREATE TABLE findings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id  UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    category    TEXT NOT NULL,
    severity    TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
    code        TEXT NOT NULL,
    message     TEXT NOT NULL,
    details     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX findings_package_idx ON findings(package_id);
CREATE INDEX findings_severity_idx ON findings(package_id, severity);

CREATE TABLE comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id  UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    screen_ref  TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_package_idx ON comments(package_id);
CREATE INDEX comments_screen_idx ON comments(package_id, screen_ref);

CREATE TABLE sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
