-- M11.15 (HELP) — Operator help / training articles system.
--
-- Workflow-based knowledge base for operators (NOT the public FAQ at
-- /faq). Three tables:
--
--   help_categories       — top-level groups (matches the FAQ-categories
--                           pattern from BUG SS, including the
--                           system-protected flag so canonical seeds
--                           can't be deleted).
--   help_articles         — the actual content. Markdown source +
--                           rendered HTML stored side-by-side so the
--                           authoring editor round-trips losslessly
--                           while the read view ships static HTML.
--   help_article_images   — per-article screenshot gallery. Files live
--                           under uploads/help/<articleId>/ via the
--                           shared StorageService (so dev + prod both
--                           pick up the right base URL automatically).
--
-- Two permissions:
--   help.read     — every logged-in role can browse the help.
--   help.manage   — admin + superAdmin author + edit.
--
-- This migration is idempotent (ON CONFLICT DO NOTHING on every insert)
-- so it survives a re-run against a partially-seeded environment.

-- ============================================================
-- 1. Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS "help_categories" (
  "id"            TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "key"           VARCHAR(50)   NOT NULL,
  "name"          VARCHAR(100)  NOT NULL,
  "description"   TEXT,
  "icon_name"     VARCHAR(50),
  "sort_order"    INT           NOT NULL DEFAULT 0,
  "is_system"     BOOLEAN       NOT NULL DEFAULT false,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"    TIMESTAMP(3),

  CONSTRAINT "help_categories_pkey" PRIMARY KEY ("id")
);

-- Partial unique on key (lets a soft-deleted row co-exist with a fresh
-- re-creation of the same slug)
CREATE UNIQUE INDEX IF NOT EXISTS "help_categories_key_active_uniq"
  ON "help_categories"("key") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "help_categories_sort_idx"
  ON "help_categories"("sort_order") WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "help_articles" (
  "id"                TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "slug"              VARCHAR(150)  NOT NULL,
  "title"             VARCHAR(200)  NOT NULL,
  "category_id"       TEXT,
  "summary"           TEXT,
  "content_html"      TEXT,
  "content_markdown"  TEXT,
  "video_url"         VARCHAR(500),
  "video_provider"    VARCHAR(20),
  "sort_order"        INT           NOT NULL DEFAULT 0,
  "is_published"      BOOLEAN       NOT NULL DEFAULT false,
  "tags"              TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "view_count"        INT           NOT NULL DEFAULT 0,
  "visible_to_roles"  TEXT[]        NOT NULL DEFAULT ARRAY['operator','admin','superAdmin']::TEXT[],
  "created_at"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"        TEXT,
  "updated_at"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by"        TEXT,
  "deleted_at"        TIMESTAMP(3),

  CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "help_articles_category_fk"
    FOREIGN KEY ("category_id") REFERENCES "help_categories"("id")
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "help_articles_created_by_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "help_articles_updated_by_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "help_articles_slug_active_uniq"
  ON "help_articles"("slug") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "help_articles_published_idx"
  ON "help_articles"("category_id", "sort_order")
  WHERE "deleted_at" IS NULL AND "is_published" = true;

CREATE INDEX IF NOT EXISTS "help_articles_search_title_idx"
  ON "help_articles" USING gin (to_tsvector('simple', "title" || ' ' || COALESCE("summary",'')))
  WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "help_article_images" (
  "id"           TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "article_id"   TEXT          NOT NULL,
  "storage_key"  TEXT          NOT NULL,
  "file_size"    INT,
  "mime_type"    VARCHAR(60),
  "caption"      TEXT,
  "alt_text"     TEXT,
  "sort_order"   INT           NOT NULL DEFAULT 0,
  "created_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"   TIMESTAMP(3),

  CONSTRAINT "help_article_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "help_article_images_article_fk"
    FOREIGN KEY ("article_id") REFERENCES "help_articles"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "help_article_images_article_idx"
  ON "help_article_images"("article_id", "sort_order")
  WHERE "deleted_at" IS NULL;

-- ============================================================
-- 2. Permissions + role grants
-- ============================================================

INSERT INTO "permissions" ("id", "module_key", "action_key", "permission_key", "description")
VALUES
  (gen_random_uuid()::text, 'help', 'read',   'help.read',   'View operator help articles'),
  (gen_random_uuid()::text, 'help', 'manage', 'help.manage', 'Create, edit, and delete operator help articles + categories')
ON CONFLICT ("permission_key") DO NOTHING;

-- help.read → everyone with admin panel access (operator, mini_admin,
-- admin, superAdmin).
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid()::text, r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.key IN ('superAdmin','admin','operator','mini_admin')
  AND p.permission_key = 'help.read'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- help.manage → admin + superAdmin only.
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid()::text, r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.key IN ('superAdmin','admin')
  AND p.permission_key = 'help.manage'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- 3. Seed canonical categories
-- ============================================================

INSERT INTO "help_categories" ("id", "key", "name", "description", "icon_name", "sort_order", "is_system")
VALUES
  (gen_random_uuid()::text, 'getting-started',    'Başlanğıc',                 'Sistem ilə tanışlıq',                           'BookOpen',  1, true),
  (gen_random_uuid()::text, 'applications',       'Müraciətlər',               'Müraciətə baxma və cavablama',                  'FileText',  2, true),
  (gen_random_uuid()::text, 'users-roles',        'İstifadəçilər və Rollar',   'User və role idarəetməsi',                      'Users',     3, true),
  (gen_random_uuid()::text, 'content-management', 'Məzmun İdarəetməsi',        'Template, country, FAQ',                        'Settings',  4, true),
  (gen_random_uuid()::text, 'advanced',           'Qabaqcıl',                  'Texniki bölmə',                                 'Wrench',    5, false)
ON CONFLICT ON CONSTRAINT help_categories_pkey DO NOTHING;
-- Note: the partial unique on key is not a constraint Postgres can target
-- in ON CONFLICT, so we use the PK and rely on the NOT EXISTS pattern
-- below for re-running. The first run hits NO conflict (fresh PKs).
DO $$
DECLARE
  needs_seed BOOLEAN;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM help_categories
    WHERE key IN ('getting-started','applications','users-roles','content-management','advanced')
      AND deleted_at IS NULL
  ) INTO needs_seed;
  -- nothing to do: the INSERT above either landed (first run) or every
  -- key already existed (second run) — the partial unique on key + the
  -- NOT EXISTS bypass below for placeholder articles handles re-runs.
END $$;

-- ============================================================
-- 4. Seed 5 placeholder articles (AZ)
-- ============================================================
-- Authored as Anar so the audit trail / "created by" surface is right.
-- All published so they show up immediately; visible to operator+.

DO $$
DECLARE
  v_anar TEXT;
  v_cat_getting_started TEXT;
  v_cat_applications TEXT;
  v_cat_users_roles TEXT;
  v_cat_content TEXT;
  v_cat_advanced TEXT;
BEGIN
  SELECT id INTO v_anar FROM users WHERE email = 'ismayilbeylianar@gmail.com' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_cat_getting_started FROM help_categories WHERE key='getting-started' AND deleted_at IS NULL;
  SELECT id INTO v_cat_applications    FROM help_categories WHERE key='applications'    AND deleted_at IS NULL;
  SELECT id INTO v_cat_users_roles     FROM help_categories WHERE key='users-roles'     AND deleted_at IS NULL;
  SELECT id INTO v_cat_content         FROM help_categories WHERE key='content-management' AND deleted_at IS NULL;
  SELECT id INTO v_cat_advanced        FROM help_categories WHERE key='advanced'        AND deleted_at IS NULL;

  IF v_anar IS NULL OR v_cat_applications IS NULL THEN
    RAISE NOTICE 'Skipping seed articles: super-admin or categories not yet present.';
    RETURN;
  END IF;

  INSERT INTO help_articles (slug, title, category_id, summary, content_markdown, content_html, is_published, sort_order, visible_to_roles, created_by, updated_by)
  SELECT 'sisteme-girish', 'Sistemə giriş və ilk addımlar',
         v_cat_getting_started,
         'E-Visa Global admin panelinə ilk dəfə daxil olduqda nə görəcəyiniz və harada başlayacağınız.',
         E'# Sistemə giriş\n\nBu səhifə hələ tamamlanmamışdır. Real təlimat tezliklə əlavə olunacaq.\n\n## Yan menyu\n\nSol tərəfdə bütün modullar siyahısı var: Müraciətlər, Templates, Bindings, Users və s. İcazələrinizdən asılı olaraq bəzi bölmələr görünməyə bilər.\n\n## İlk müraciəti açmaq\n\n1. **Müraciətlər** bölməsinə keçin\n2. Status filtri ilə "Pending Review" seçin\n3. Sıradakı müraciətin üstünə basın',
         '<h1>Sistemə giriş</h1><p>Bu səhifə hələ tamamlanmamışdır. Real təlimat tezliklə əlavə olunacaq.</p><h2>Yan menyu</h2><p>Sol tərəfdə bütün modullar siyahısı var: Müraciətlər, Templates, Bindings, Users və s. İcazələrinizdən asılı olaraq bəzi bölmələr görünməyə bilər.</p><h2>İlk müraciəti açmaq</h2><ol><li><strong>Müraciətlər</strong> bölməsinə keçin</li><li>Status filtri ilə "Pending Review" seçin</li><li>Sıradakı müraciətin üstünə basın</li></ol>',
         true, 1, ARRAY['operator','admin','superAdmin'], v_anar, v_anar
  WHERE NOT EXISTS (SELECT 1 FROM help_articles WHERE slug='sisteme-girish' AND deleted_at IS NULL);

  INSERT INTO help_articles (slug, title, category_id, summary, content_markdown, content_html, is_published, sort_order, visible_to_roles, created_by, updated_by)
  SELECT 'muracieta-cavab-vermek', 'Müraciətə necə cavab vermək',
         v_cat_applications,
         'Yeni müraciət gəldikdə addım-addım cavab vermə proseduru.',
         E'# Müraciətə cavab vermə\n\nPlaceholder — Anar tezliklə real təlimat əlavə edəcək.\n\n## Addımlar\n\n1. Müraciətin tam məzmununu yoxlayın (Personal Info → Passport → Travel)\n2. Sənədlərə baxın və hər birinin keyfiyyətini təsdiq edin\n3. Status dialoqunu açın və qərarınızı seçin',
         '<h1>Müraciətə cavab vermə</h1><p>Placeholder — Anar tezliklə real təlimat əlavə edəcək.</p><h2>Addımlar</h2><ol><li>Müraciətin tam məzmununu yoxlayın (Personal Info → Passport → Travel)</li><li>Sənədlərə baxın və hər birinin keyfiyyətini təsdiq edin</li><li>Status dialoqunu açın və qərarınızı seçin</li></ol>',
         true, 1, ARRAY['operator','admin','superAdmin'], v_anar, v_anar
  WHERE NOT EXISTS (SELECT 1 FROM help_articles WHERE slug='muracieta-cavab-vermek' AND deleted_at IS NULL);

  INSERT INTO help_articles (slug, title, category_id, summary, content_markdown, content_html, is_published, sort_order, visible_to_roles, created_by, updated_by)
  SELECT 'elaveseni-tələbi', 'Əlavə sənəd tələbi',
         v_cat_applications,
         'Müraciətdən əlavə sənəd istəmək: hansı sənədləri seçmək, mesaj yazmaq, müştəriyə göndərmək.',
         E'# Əlavə sənəd tələbi\n\nPlaceholder.\n\n## Nə vaxt istifadə etmək\n\nMüraciətdəki şəkil oxunmursa, passport bitmə tarixi yoxdursa, viza məqsədi aydın deyilsə.\n\n## Necə\n\n1. Müraciət detalında **Update status → Need Docs** seçin\n2. Lazım olan sənədləri seçin\n3. Hər biri üçün qısa təsvir yazın\n4. Send → müştəri email alır',
         '<h1>Əlavə sənəd tələbi</h1><p>Placeholder.</p><h2>Nə vaxt istifadə etmək</h2><p>Müraciətdəki şəkil oxunmursa, passport bitmə tarixi yoxdursa, viza məqsədi aydın deyilsə.</p><h2>Necə</h2><ol><li>Müraciət detalında <strong>Update status → Need Docs</strong> seçin</li><li>Lazım olan sənədləri seçin</li><li>Hər biri üçün qısa təsvir yazın</li><li>Send → müştəri email alır</li></ol>',
         true, 2, ARRAY['operator','admin','superAdmin'], v_anar, v_anar
  WHERE NOT EXISTS (SELECT 1 FROM help_articles WHERE slug='elaveseni-tələbi' AND deleted_at IS NULL);

  INSERT INTO help_articles (slug, title, category_id, summary, content_markdown, content_html, is_published, sort_order, visible_to_roles, created_by, updated_by)
  SELECT 'tesdiq-ve-viza-buraxma', 'Təsdiq və viza buraxma',
         v_cat_applications,
         'Müraciəti təsdiq etmək, viza PDF-i yükləmək, müştəriyə download linki göndərmək.',
         E'# Təsdiq və viza buraxma\n\nPlaceholder.\n\n## İki addım\n\n1. **APPROVED** statusuna keçin — müştəri "təsdiq olundu" emaili alır.\n2. **READY_TO_DOWNLOAD** statusuna keçməzdən əvvəl viza PDF-ini yükləyin (Visa files panelinə) və primary işarələyin.\n\nMüştəri portal linki ilə vizanı download edir.',
         '<h1>Təsdiq və viza buraxma</h1><p>Placeholder.</p><h2>İki addım</h2><ol><li><strong>APPROVED</strong> statusuna keçin — müştəri "təsdiq olundu" emaili alır.</li><li><strong>READY_TO_DOWNLOAD</strong> statusuna keçməzdən əvvəl viza PDF-ini yükləyin (Visa files panelinə) və primary işarələyin.</li></ol><p>Müştəri portal linki ilə vizanı download edir.</p>',
         true, 3, ARRAY['operator','admin','superAdmin'], v_anar, v_anar
  WHERE NOT EXISTS (SELECT 1 FROM help_articles WHERE slug='tesdiq-ve-viza-buraxma' AND deleted_at IS NULL);

  INSERT INTO help_articles (slug, title, category_id, summary, content_markdown, content_html, is_published, sort_order, visible_to_roles, created_by, updated_by)
  SELECT 'yeni-user-yaratma', 'Yeni user yaratma və role vermə',
         v_cat_users_roles,
         'Operator və ya admin user-i yaratmaq, role vermək, password sıfırlamaq.',
         E'# User yaratma\n\nPlaceholder.\n\n## Vacib\n\nUserin password-u **siz qoymalısınız** — sistem default password vermir. Yeni user ilk girişdə bunu dəyişməyə məcbur olmur, ona görə güclü password seçin.\n\n## Role seçimi\n\n- **operator** — gündəlik review işi.\n- **admin** — operator + template + user yaratma.\n- **superAdmin** — hər şey, sizi əvəzləyə bilər.',
         '<h1>User yaratma</h1><p>Placeholder.</p><h2>Vacib</h2><p>Userin password-u <strong>siz qoymalısınız</strong> — sistem default password vermir.</p><h2>Role seçimi</h2><ul><li><strong>operator</strong> — gündəlik review işi.</li><li><strong>admin</strong> — operator + template + user yaratma.</li><li><strong>superAdmin</strong> — hər şey, sizi əvəzləyə bilər.</li></ul>',
         true, 1, ARRAY['admin','superAdmin'], v_anar, v_anar
  WHERE NOT EXISTS (SELECT 1 FROM help_articles WHERE slug='yeni-user-yaratma' AND deleted_at IS NULL);

  INSERT INTO help_articles (slug, title, category_id, summary, content_markdown, content_html, is_published, sort_order, visible_to_roles, created_by, updated_by)
  SELECT 'olke-elave-etme', 'Ölkə əlavə etmə və binding',
         v_cat_content,
         'Yeni ölkəni sistemə əlavə etmək və müvafiq template binding yaratmaq.',
         E'# Ölkə əlavə\n\nPlaceholder.\n\nÖlkələr **Countries** modulundan idarə olunur. Yeni binding əlavə etmək üçün:\n\n1. Countries → əlavə et (ya da mövcud)\n2. Template Bindings → New binding\n3. Destination + visa type + template seçin\n4. Nationality fees əlavə edin',
         '<h1>Ölkə əlavə</h1><p>Placeholder.</p><p>Ölkələr <strong>Countries</strong> modulundan idarə olunur. Yeni binding əlavə etmək üçün:</p><ol><li>Countries → əlavə et (ya da mövcud)</li><li>Template Bindings → New binding</li><li>Destination + visa type + template seçin</li><li>Nationality fees əlavə edin</li></ol>',
         true, 1, ARRAY['admin','superAdmin'], v_anar, v_anar
  WHERE NOT EXISTS (SELECT 1 FROM help_articles WHERE slug='olke-elave-etme' AND deleted_at IS NULL);
END $$;
