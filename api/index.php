<?php

declare(strict_types=1);

use TheSex\Api\Config;
use TheSex\Api\Database;
use TheSex\Api\Response;

spl_autoload_register(static function (string $class): void {
    $prefix = 'TheSex\\Api\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $file = __DIR__ . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

function api_uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function api_request_path(): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
    if ($base !== '' && str_starts_with($path, $base)) {
        $path = substr($path, strlen($base));
    }
    return '/' . trim($path, '/');
}

function api_validate_same_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }

    $originHost = parse_url($origin, PHP_URL_HOST);
    $requestHost = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];
    if (!$originHost || !hash_equals($requestHost, $originHost)) {
        Response::error('Origem não permitida.', 403);
    }
}

function api_json_body(): array
{
    $body = json_decode((string) file_get_contents('php://input'), true);
    return is_array($body) ? $body : [];
}

function api_start_admin_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $isSecure = str_starts_with(Config::get('APP_URL', '') ?? '', 'https://');
    session_name('thesex_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/api/',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function api_require_admin(PDO $pdo): array
{
    api_start_admin_session();
    $adminId = filter_var($_SESSION['admin_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$adminId) {
        Response::error('Autenticação necessária.', 401);
    }

    $statement = $pdo->prepare('SELECT id, email FROM admins WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $adminId]);
    $admin = $statement->fetch();
    if (!$admin) {
        $_SESSION = [];
        session_destroy();
        Response::error('Sessão expirada.', 401);
    }

    return $admin;
}

function api_profile_output(array $profile, array $photos): array
{
    $tags = json_decode((string) $profile['tags'], true);
    $services = json_decode((string) ($profile['services'] ?? '[]'), true);
    $serviceFor = json_decode((string) ($profile['service_for'] ?? '[]'), true);
    $meetingPlaces = json_decode((string) ($profile['meeting_places'] ?? '[]'), true);
    $paymentMethods = json_decode((string) ($profile['payment_methods'] ?? '[]'), true);
    return [
        'id' => $profile['id'],
        'name' => $profile['display_name'],
        'age' => (int) $profile['age'],
        'category' => $profile['category'] ?? 'Acompanhante',
        'city' => $profile['city'],
        'neighborhood' => $profile['neighborhood'] ?? '',
        'price' => $profile['price_label'],
        'contact_phone' => $profile['contact_phone'] ?? '',
        'availability' => $profile['availability'] ?? '',
        'services' => is_array($services) ? array_values($services) : [],
        'service_for' => is_array($serviceFor) ? array_values($serviceFor) : [],
        'meeting_places' => is_array($meetingPlaces) ? array_values($meetingPlaces) : [],
        'payment_methods' => is_array($paymentMethods) ? array_values($paymentMethods) : [],
        'description' => $profile['description'] ?? '',
        'tags' => is_array($tags) ? array_values($tags) : [],
        'photos' => array_map(static fn(array $photo): string => '/api/' . ltrim($photo['path'], '/'), $photos),
        'is_featured' => (bool) $profile['is_featured'],
    ];
}

function api_xml_escape(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function api_slugify(string $value): string
{
    $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    $value = $transliterated === false ? $value : $transliterated;
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    $value = trim($value, '-');
    return substr($value, 0, 72) ?: 'perfil';
}

function api_public_profile_path(array $profile): string
{
    $suffix = substr(str_replace('-', '', (string) $profile['id']), -12);
    $categories = [
        'Acompanhante' => 'acompanhantes',
        'Massagem' => 'massagens',
        'Trans e Travesti' => 'trans-e-travestis',
        'Encontro casual' => 'encontros-casuais',
    ];
    $category = $categories[(string) ($profile['category'] ?? '')] ?? 'perfis';
    return '/' . $category . '/' . api_slugify((string) $profile['city']) . '/' . api_slugify((string) $profile['display_name']) . '-' . $suffix;
}

function api_serve_sitemap(PDO $pdo): never
{
    $baseUrl = 'https://thesex.online';
    $regions = [
        'sao-paulo', 'rio-de-janeiro', 'belo-horizonte', 'brasilia', 'curitiba',
        'salvador', 'porto-alegre', 'recife', 'fortaleza', 'goiania',
    ];
    $urls = [[
        'loc' => $baseUrl . '/',
        'lastmod' => gmdate('Y-m-d'),
        'changefreq' => 'daily',
        'priority' => '1.0',
    ]];

    foreach ($regions as $region) {
        $urls[] = [
            'loc' => $baseUrl . '/' . $region,
            'lastmod' => gmdate('Y-m-d'),
            'changefreq' => $region === 'sao-paulo' || $region === 'rio-de-janeiro' ? 'daily' : 'weekly',
            'priority' => $region === 'sao-paulo' || $region === 'rio-de-janeiro' ? '0.9' : '0.8',
        ];
    }

    $profiles = $pdo->query("SELECT id, display_name, category, city, updated_at FROM profiles WHERE status = 'active' ORDER BY updated_at DESC LIMIT 50000");
    foreach ($profiles->fetchAll() as $profile) {
        $urls[] = [
            'loc' => $baseUrl . api_public_profile_path($profile),
            'lastmod' => substr((string) $profile['updated_at'], 0, 10),
            'changefreq' => 'weekly',
            'priority' => '0.7',
        ];
    }

    header('Content-Type: application/xml; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($urls as $url) {
        echo "  <url>\n";
        echo '    <loc>' . api_xml_escape($url['loc']) . "</loc>\n";
        echo '    <lastmod>' . api_xml_escape($url['lastmod']) . "</lastmod>\n";
        echo '    <changefreq>' . api_xml_escape($url['changefreq']) . "</changefreq>\n";
        echo '    <priority>' . api_xml_escape($url['priority']) . "</priority>\n";
        echo "  </url>\n";
    }
    echo "</urlset>\n";
    exit;
}

function api_start_member_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $isSecure = str_starts_with(Config::get('APP_URL', '') ?? '', 'https://');
    session_name('thesex_member');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/api/',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function api_require_member(PDO $pdo): array
{
    api_start_member_session();
    $memberId = filter_var($_SESSION['member_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$memberId) {
        Response::error('Autenticação necessária.', 401);
    }

    $statement = $pdo->prepare('SELECT id, email, display_name, marketing_opt_in, created_at FROM members WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $memberId]);
    $member = $statement->fetch();
    if (!$member) {
        $_SESSION = [];
        session_destroy();
        Response::error('Sessão expirada.', 401);
    }

    return $member;
}

function api_optional_member(PDO $pdo): ?array
{
    api_start_member_session();
    $memberId = filter_var($_SESSION['member_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$memberId) {
        return null;
    }

    $statement = $pdo->prepare('SELECT id, email, display_name, marketing_opt_in, created_at FROM members WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $memberId]);
    return $statement->fetch() ?: null;
}

function api_migrate_profiles(PDO $pdo): void
{
    static $migrated = false;
    if ($migrated) {
        return;
    }

    $columns = $pdo->query('SHOW COLUMNS FROM profiles')->fetchAll(PDO::FETCH_COLUMN);
    $columns = array_flip($columns);
    $changes = [
        'category' => "ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'Acompanhante' AFTER age",
        'neighborhood' => 'ADD COLUMN neighborhood VARCHAR(120) NULL AFTER city',
        'contact_phone' => 'ADD COLUMN contact_phone VARCHAR(40) NULL AFTER price_label',
        'availability' => 'ADD COLUMN availability VARCHAR(160) NULL AFTER contact_phone',
        'moderation_note' => 'ADD COLUMN moderation_note TEXT NULL AFTER availability',
        'services' => 'ADD COLUMN services JSON NULL AFTER availability',
        'service_for' => 'ADD COLUMN service_for JSON NULL AFTER services',
        'meeting_places' => 'ADD COLUMN meeting_places JSON NULL AFTER service_for',
        'payment_methods' => 'ADD COLUMN payment_methods JSON NULL AFTER meeting_places',
        'auto_approved' => 'ADD COLUMN auto_approved TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured',
    ];

    foreach ($changes as $column => $statement) {
        if (!isset($columns[$column])) {
            $pdo->exec("ALTER TABLE profiles {$statement}");
        }
    }

    // Converte eventuais valores antigos para a taxonomia pública atual.
    $pdo->exec("UPDATE profiles SET category = 'Acompanhante' WHERE category NOT IN ('Acompanhante', 'Massagem', 'Trans e Travesti', 'Encontro casual')");

    $migrated = true;
}

function api_migrate_members(PDO $pdo): void
{
    static $migrated = false;
    if ($migrated) {
        return;
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS members (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(190) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(80) NULL,
        marketing_opt_in TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $columns = $pdo->query('SHOW COLUMNS FROM profiles')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('member_id', $columns, true)) {
        $pdo->exec('ALTER TABLE profiles ADD COLUMN member_id BIGINT UNSIGNED NULL AFTER id');
    }
    $migrated = true;
}

function api_migrate_club(PDO $pdo): void
{
    static $migrated = false;
    if ($migrated) {
        return;
    }

    // The Club lives beside the classifieds app while both products share the
    // same member identity. The migration marker avoids metadata locks from
    // running DDL on every PHP request after the first upgrade.
    $pdo->exec("CREATE TABLE IF NOT EXISTS platform_migrations (
        version VARCHAR(80) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $marker = $pdo->prepare('SELECT version FROM platform_migrations WHERE version = :version LIMIT 1');
    $marker->execute(['version' => '20260806_club_foundation']);
    if ($marker->fetch()) {
        $migrated = true;
        return;
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS club_creators (
        id CHAR(36) NOT NULL PRIMARY KEY,
        member_id BIGINT UNSIGNED NOT NULL,
        profile_id CHAR(36) NOT NULL,
        username VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(80) NOT NULL,
        bio VARCHAR(1000) NULL,
        monthly_price_cents INT UNSIGNED NOT NULL DEFAULT 0,
        status ENUM('pending', 'active', 'paused', 'rejected') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY club_creators_profile_unique (profile_id),
        KEY club_creators_member_index (member_id, created_at),
        KEY club_creators_status_index (status, created_at),
        CONSTRAINT club_creators_member_fk FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        CONSTRAINT club_creators_profile_fk FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS club_posts (
        id CHAR(36) NOT NULL PRIMARY KEY,
        creator_id CHAR(36) NOT NULL,
        caption VARCHAR(2200) NOT NULL,
        visibility ENUM('public', 'subscribers', 'ppv') NOT NULL DEFAULT 'subscribers',
        price_cents INT UNSIGNED NOT NULL DEFAULT 0,
        media JSON NOT NULL,
        status ENUM('draft', 'pending', 'published', 'archived') NOT NULL DEFAULT 'draft',
        published_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY club_posts_feed_index (status, visibility, published_at),
        KEY club_posts_creator_index (creator_id, created_at),
        CONSTRAINT club_posts_creator_fk FOREIGN KEY (creator_id) REFERENCES club_creators(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS club_subscriptions (
        id CHAR(36) NOT NULL PRIMARY KEY,
        member_id BIGINT UNSIGNED NOT NULL,
        creator_id CHAR(36) NOT NULL,
        status ENUM('pending', 'active', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
        amount_cents INT UNSIGNED NOT NULL,
        started_at TIMESTAMP NULL,
        ends_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY club_subscriptions_member_index (member_id, status),
        KEY club_subscriptions_creator_index (creator_id, status),
        CONSTRAINT club_subscriptions_member_fk FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        CONSTRAINT club_subscriptions_creator_fk FOREIGN KEY (creator_id) REFERENCES club_creators(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS club_orders (
        id CHAR(36) NOT NULL PRIMARY KEY,
        member_id BIGINT UNSIGNED NOT NULL,
        creator_id CHAR(36) NOT NULL,
        post_id CHAR(36) NULL,
        kind ENUM('subscription', 'ppv', 'tip') NOT NULL,
        amount_cents INT UNSIGNED NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'BRL',
        status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
        gateway_reference VARCHAR(120) NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY club_orders_member_index (member_id, created_at),
        KEY club_orders_creator_index (creator_id, created_at),
        KEY club_orders_status_index (status, created_at),
        CONSTRAINT club_orders_member_fk FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        CONSTRAINT club_orders_creator_fk FOREIGN KEY (creator_id) REFERENCES club_creators(id) ON DELETE CASCADE,
        CONSTRAINT club_orders_post_fk FOREIGN KEY (post_id) REFERENCES club_posts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS club_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        creator_id CHAR(36) NULL,
        post_id CHAR(36) NULL,
        member_id BIGINT UNSIGNED NULL,
        event_type VARCHAR(48) NOT NULL,
        metadata JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY club_events_creator_index (creator_id, created_at),
        KEY club_events_post_index (post_id, created_at),
        KEY club_events_type_index (event_type, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->prepare('INSERT INTO platform_migrations (version) VALUES (:version)')->execute(['version' => '20260806_club_foundation']);
    $migrated = true;
}

function api_club_creator_output(array $creator): array
{
    return [
        'id' => $creator['id'],
        'username' => $creator['username'],
        'display_name' => $creator['display_name'],
        'bio' => $creator['bio'] ?? '',
        'monthly_price_cents' => (int) $creator['monthly_price_cents'],
        'status' => $creator['status'],
        'profile_url' => isset($creator['profile_id'], $creator['category'], $creator['city'], $creator['profile_name'])
            ? api_public_profile_path(['id' => $creator['profile_id'], 'category' => $creator['category'], 'city' => $creator['city'], 'display_name' => $creator['profile_name']])
            : null,
        'cover_photo' => !empty($creator['cover_photo']) ? '/api/' . ltrim((string) $creator['cover_photo'], '/') : null,
        'created_at' => $creator['created_at'],
    ];
}

function api_club_post_output(array $post): array
{
    $media = json_decode((string) ($post['media'] ?? '[]'), true);
    return [
        'id' => $post['id'],
        'creator_id' => $post['creator_id'],
        'caption' => $post['caption'],
        'visibility' => $post['visibility'],
        'price_cents' => (int) $post['price_cents'],
        'media' => is_array($media) ? array_values($media) : [],
        'status' => $post['status'],
        'published_at' => $post['published_at'],
        'created_at' => $post['created_at'],
        'creator_username' => $post['creator_username'] ?? null,
        'creator_name' => $post['creator_name'] ?? null,
    ];
}

function api_admin_profile_output(array $profile, array $photos): array
{
    return array_merge(api_profile_output($profile, $photos), [
        'status' => $profile['status'],
        'moderation_note' => $profile['moderation_note'] ?? '',
        'created_at' => $profile['created_at'],
        'updated_at' => $profile['updated_at'],
        'member_id' => isset($profile['member_id']) ? (int) $profile['member_id'] : null,
        'member_email' => $profile['member_email'] ?? '',
        'auto_approved' => !empty($profile['auto_approved']),
    ]);
}

function api_audit(PDO $pdo, int $adminId, string $action, ?string $profileId = null, array $details = []): void
{
    $statement = $pdo->prepare('INSERT INTO admin_audit_logs (admin_id, action, target_profile_id, details) VALUES (:admin_id, :action, :profile_id, :details)');
    $statement->execute([
        'admin_id' => $adminId,
        'action' => $action,
        'profile_id' => $profileId,
        'details' => $details === [] ? null : json_encode($details, JSON_UNESCAPED_UNICODE),
    ]);
}

try {
    Config::load(__DIR__ . '/.env');
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $path = api_request_path();

    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if ($method === 'GET' && $path === '/v1/health') {
        Database::connect();
        Response::json(['status' => 'ok']);
    }

    $pdo = Database::connect();
    api_migrate_members($pdo);
    api_migrate_profiles($pdo);
    api_migrate_club($pdo);

    if ($method === 'GET' && ($_GET['seo_sitemap'] ?? '') === '1') {
        api_serve_sitemap($pdo);
    }

    if (str_starts_with($path, '/v1/admin/')) {
        api_start_admin_session();
    }
    if (str_starts_with($path, '/v1/member/')) {
        api_start_member_session();
    }

    if ($method === 'POST' && $path === '/v1/member/register') {
        api_validate_same_origin();
        $body = api_json_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $displayName = trim((string) ($body['display_name'] ?? ''));
        $marketingOptIn = !empty($body['marketing_opt_in']) ? 1 : 0;
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12 || mb_strlen($displayName) > 80 || empty($body['adult_confirmed'])) {
            Response::error('Informe e-mail, senha de pelo menos 12 caracteres e confirme a maioridade.', 422);
        }
        try {
            $statement = $pdo->prepare('INSERT INTO members (email, password_hash, display_name, marketing_opt_in) VALUES (:email, :password_hash, :display_name, :marketing_opt_in)');
            $statement->execute(['email' => $email, 'password_hash' => password_hash($password, PASSWORD_DEFAULT), 'display_name' => $displayName ?: null, 'marketing_opt_in' => $marketingOptIn]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                Response::error('Já existe uma conta com este e-mail.', 409);
            }
            throw $exception;
        }
        session_regenerate_id(true);
        $_SESSION['member_id'] = (int) $pdo->lastInsertId();
        Response::json(['data' => ['id' => (int) $_SESSION['member_id'], 'email' => $email, 'display_name' => $displayName, 'marketing_opt_in' => (bool) $marketingOptIn]], 201);
    }

    if ($method === 'POST' && $path === '/v1/member/login') {
        api_validate_same_origin();
        $body = api_json_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $statement = $pdo->prepare('SELECT id, email, password_hash, display_name, marketing_opt_in FROM members WHERE email = :email LIMIT 1');
        $statement->execute(['email' => $email]);
        $member = $statement->fetch();
        if (!$member || !password_verify($password, $member['password_hash'])) {
            Response::error('E-mail ou senha inválidos.', 401);
        }
        session_regenerate_id(true);
        $_SESSION['member_id'] = (int) $member['id'];
        Response::json(['data' => ['id' => (int) $member['id'], 'email' => $member['email'], 'display_name' => $member['display_name'] ?? '', 'marketing_opt_in' => (bool) $member['marketing_opt_in']]]);
    }

    if ($method === 'POST' && $path === '/v1/member/logout') {
        api_validate_same_origin();
        api_require_member($pdo);
        $_SESSION = [];
        session_destroy();
        Response::json(['data' => ['signed_out' => true]]);
    }

    if ($method === 'GET' && $path === '/v1/member/me') {
        $member = api_require_member($pdo);
        Response::json(['data' => ['id' => (int) $member['id'], 'email' => $member['email'], 'display_name' => $member['display_name'] ?? '', 'marketing_opt_in' => (bool) $member['marketing_opt_in']]]);
    }

    if ($method === 'GET' && $path === '/v1/member/dashboard') {
        $member = api_require_member($pdo);
        $counts = ['pending' => 0, 'active' => 0, 'rejected' => 0, 'archived' => 0];
        $statement = $pdo->prepare('SELECT status, COUNT(*) AS total FROM profiles WHERE member_id = :member_id GROUP BY status');
        $statement->execute(['member_id' => $member['id']]);
        foreach ($statement->fetchAll() as $row) {
            $counts[$row['status']] = (int) $row['total'];
        }
        Response::json(['data' => ['member' => ['id' => (int) $member['id'], 'email' => $member['email'], 'display_name' => $member['display_name'] ?? '', 'marketing_opt_in' => (bool) $member['marketing_opt_in']], 'counts' => $counts]]);
    }

    if ($method === 'GET' && $path === '/v1/member/profiles') {
        $member = api_require_member($pdo);
        $statement = $pdo->prepare('SELECT * FROM profiles WHERE member_id = :member_id ORDER BY created_at DESC LIMIT 100');
        $statement->execute(['member_id' => $member['id']]);
        $photoStatement = $pdo->prepare('SELECT path FROM profile_photos WHERE profile_id = :profile_id ORDER BY position ASC');
        $data = [];
        foreach ($statement->fetchAll() as $profile) {
            $photoStatement->execute(['profile_id' => $profile['id']]);
            $data[] = api_admin_profile_output($profile, $photoStatement->fetchAll());
        }
        Response::json(['data' => $data]);
    }

    if ($method === 'PATCH' && preg_match('#^/v1/member/profiles/([a-f0-9-]{36})$#i', $path, $matches)) {
        api_validate_same_origin();
        $member = api_require_member($pdo);
        $body = api_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        $age = filter_var($body['age'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 18, 'max_range' => 99]]);
        $category = trim((string) ($body['category'] ?? ''));
        $city = trim((string) ($body['city'] ?? ''));
        $neighborhood = trim((string) ($body['neighborhood'] ?? ''));
        $price = trim((string) ($body['price'] ?? ''));
        $contactPhone = trim((string) ($body['contact_phone'] ?? ''));
        $availability = trim((string) ($body['availability'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));
        $tags = $body['tags'] ?? [];
        $services = $body['services'] ?? [];
        $serviceFor = $body['service_for'] ?? [];
        $meetingPlaces = $body['meeting_places'] ?? [];
        $paymentMethods = $body['payment_methods'] ?? [];
        $allowedCategories = ['Acompanhante', 'Massagem', 'Trans e Travesti', 'Encontro casual'];
        $lists = [$tags, $services, $serviceFor, $meetingPlaces, $paymentMethods];
        $invalidList = false;
        foreach ($lists as $list) {
            if (!is_array($list) || count($list) > 12) {
                $invalidList = true;
                break;
            }
            foreach ($list as $value) {
                if (!is_string($value) || mb_strlen($value) > 60) {
                    $invalidList = true;
                    break 2;
                }
            }
        }
        if ($name === '' || mb_strlen($name) > 80 || !$age || !in_array($category, $allowedCategories, true) || $city === '' || mb_strlen($city) > 120 || mb_strlen($neighborhood) > 120 || $price === '' || mb_strlen($price) > 80 || mb_strlen($contactPhone) < 8 || mb_strlen($contactPhone) > 40 || mb_strlen($availability) > 160 || mb_strlen($description) > 2000 || $invalidList) {
            Response::error('Verifique os dados do perfil antes de salvar.', 422);
        }
        $statement = $pdo->prepare('UPDATE profiles SET display_name = :name, age = :age, category = :category, city = :city, neighborhood = :neighborhood, price_label = :price, contact_phone = :contact_phone, availability = :availability, services = :services, service_for = :service_for, meeting_places = :meeting_places, payment_methods = :payment_methods, description = :description, tags = :tags, status = CASE WHEN auto_approved = 1 THEN "active" ELSE "pending" END, is_featured = 0, moderation_note = NULL WHERE id = :id AND member_id = :member_id');
        $statement->execute(['name' => $name, 'age' => $age, 'category' => $category, 'city' => $city, 'neighborhood' => $neighborhood ?: null, 'price' => $price, 'contact_phone' => $contactPhone, 'availability' => $availability ?: null, 'services' => json_encode(array_values($services), JSON_UNESCAPED_UNICODE), 'service_for' => json_encode(array_values($serviceFor), JSON_UNESCAPED_UNICODE), 'meeting_places' => json_encode(array_values($meetingPlaces), JSON_UNESCAPED_UNICODE), 'payment_methods' => json_encode(array_values($paymentMethods), JSON_UNESCAPED_UNICODE), 'description' => $description, 'tags' => json_encode(array_values($tags), JSON_UNESCAPED_UNICODE), 'id' => $matches[1], 'member_id' => $member['id']]);
        if ($statement->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM profiles WHERE id = :id AND member_id = :member_id LIMIT 1');
            $exists->execute(['id' => $matches[1], 'member_id' => $member['id']]);
            if (!$exists->fetch()) {
                Response::error('Perfil não encontrado.', 404);
            }
        }
        $profileStatement = $pdo->prepare('SELECT * FROM profiles WHERE id = :id AND member_id = :member_id LIMIT 1');
        $profileStatement->execute(['id' => $matches[1], 'member_id' => $member['id']]);
        $profile = $profileStatement->fetch();
        $photoStatement = $pdo->prepare('SELECT path FROM profile_photos WHERE profile_id = :profile_id ORDER BY position ASC');
        $photoStatement->execute(['profile_id' => $matches[1]]);
        Response::json(['data' => api_admin_profile_output($profile, $photoStatement->fetchAll())]);
    }

    if ($method === 'PATCH' && preg_match('#^/v1/member/profiles/([a-f0-9-]{36})/status$#i', $path, $matches)) {
        api_validate_same_origin();
        $member = api_require_member($pdo);
        $status = (string) (api_json_body()['status'] ?? '');
        if (!in_array($status, ['pending', 'archived'], true)) {
            Response::error('Ação de perfil inválida.', 422);
        }
        $statement = $pdo->prepare('UPDATE profiles SET status = CASE WHEN :status = "pending" AND auto_approved = 1 THEN "active" ELSE :status END, is_featured = 0 WHERE id = :id AND member_id = :member_id');
        $statement->execute(['status' => $status, 'id' => $matches[1], 'member_id' => $member['id']]);
        if ($statement->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM profiles WHERE id = :id AND member_id = :member_id LIMIT 1');
            $exists->execute(['id' => $matches[1], 'member_id' => $member['id']]);
            if (!$exists->fetch()) {
                Response::error('Perfil não encontrado.', 404);
            }
        }
        $profileStatement = $pdo->prepare('SELECT * FROM profiles WHERE id = :id AND member_id = :member_id LIMIT 1');
        $profileStatement->execute(['id' => $matches[1], 'member_id' => $member['id']]);
        $profile = $profileStatement->fetch();
        $photoStatement = $pdo->prepare('SELECT path FROM profile_photos WHERE profile_id = :profile_id ORDER BY position ASC');
        $photoStatement->execute(['profile_id' => $matches[1]]);
        Response::json(['data' => api_admin_profile_output($profile, $photoStatement->fetchAll())]);
    }

    if ($method === 'PATCH' && $path === '/v1/member/settings') {
        api_validate_same_origin();
        $member = api_require_member($pdo);
        $body = api_json_body();
        $displayName = trim((string) ($body['display_name'] ?? ''));
        if (mb_strlen($displayName) > 80) {
            Response::error('O nome de exibição é muito longo.', 422);
        }
        $marketingOptIn = !empty($body['marketing_opt_in']) ? 1 : 0;
        $pdo->prepare('UPDATE members SET display_name = :display_name, marketing_opt_in = :marketing_opt_in WHERE id = :id')->execute(['display_name' => $displayName ?: null, 'marketing_opt_in' => $marketingOptIn, 'id' => $member['id']]);
        Response::json(['data' => ['id' => (int) $member['id'], 'email' => $member['email'], 'display_name' => $displayName, 'marketing_opt_in' => (bool) $marketingOptIn]]);
    }

    if ($method === 'POST' && $path === '/v1/member/password') {
        api_validate_same_origin();
        $member = api_require_member($pdo);
        $body = api_json_body();
        $currentPassword = (string) ($body['current_password'] ?? '');
        $newPassword = (string) ($body['new_password'] ?? '');
        if (strlen($newPassword) < 12) {
            Response::error('A nova senha precisa ter pelo menos 12 caracteres.', 422);
        }
        $statement = $pdo->prepare('SELECT password_hash FROM members WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $member['id']]);
        if (!password_verify($currentPassword, (string) $statement->fetchColumn())) {
            Response::error('A senha atual está incorreta.', 401);
        }
        $pdo->prepare('UPDATE members SET password_hash = :password_hash WHERE id = :id')->execute(['password_hash' => password_hash($newPassword, PASSWORD_DEFAULT), 'id' => $member['id']]);
        session_regenerate_id(true);
        Response::json(['data' => ['updated' => true]]);
    }

    if ($method === 'POST' && $path === '/v1/admin/login') {
        api_validate_same_origin();
        $body = api_json_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            Response::error('Informe e-mail e senha válidos.', 422);
        }

        $statement = $pdo->prepare('SELECT id, email, password_hash FROM admins WHERE email = :email LIMIT 1');
        $statement->execute(['email' => $email]);
        $admin = $statement->fetch();
        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            Response::error('E-mail ou senha inválidos.', 401);
        }

        session_regenerate_id(true);
        $_SESSION['admin_id'] = (int) $admin['id'];
        Response::json(['data' => ['id' => (int) $admin['id'], 'email' => $admin['email']]]);
    }

    if ($method === 'POST' && $path === '/v1/admin/logout') {
        api_validate_same_origin();
        api_require_admin($pdo);
        $_SESSION = [];
        session_destroy();
        Response::json(['data' => ['signed_out' => true]]);
    }

    if ($method === 'GET' && $path === '/v1/admin/me') {
        $admin = api_require_admin($pdo);
        Response::json(['data' => ['id' => (int) $admin['id'], 'email' => $admin['email']]]);
    }

    if ($method === 'POST' && $path === '/v1/admin/password') {
        api_validate_same_origin();
        $admin = api_require_admin($pdo);
        $body = api_json_body();
        $currentPassword = (string) ($body['current_password'] ?? '');
        $newPassword = (string) ($body['new_password'] ?? '');
        if (strlen($newPassword) < 12) {
            Response::error('A nova senha precisa ter pelo menos 12 caracteres.', 422);
        }

        $credentials = $pdo->prepare('SELECT password_hash FROM admins WHERE id = :id LIMIT 1');
        $credentials->execute(['id' => $admin['id']]);
        $passwordHash = (string) $credentials->fetchColumn();
        if (!password_verify($currentPassword, $passwordHash)) {
            Response::error('A senha atual está incorreta.', 401);
        }

        $pdo->prepare('UPDATE admins SET password_hash = :password_hash WHERE id = :id')->execute([
            'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
            'id' => $admin['id'],
        ]);
        session_regenerate_id(true);
        api_audit($pdo, (int) $admin['id'], 'password_changed');
        Response::json(['data' => ['updated' => true]]);
    }

    if ($method === 'GET' && $path === '/v1/admin/audit') {
        api_require_admin($pdo);
        $statement = $pdo->query('SELECT admin_audit_logs.action, admin_audit_logs.target_profile_id, admin_audit_logs.details, admin_audit_logs.created_at, admins.email AS admin_email FROM admin_audit_logs INNER JOIN admins ON admins.id = admin_audit_logs.admin_id ORDER BY admin_audit_logs.created_at DESC LIMIT 50');
        $data = array_map(static function (array $row): array {
            $details = json_decode((string) $row['details'], true);
            return [
                'action' => $row['action'],
                'profile_id' => $row['target_profile_id'],
                'details' => is_array($details) ? $details : [],
                'created_at' => $row['created_at'],
                'admin_email' => $row['admin_email'],
            ];
        }, $statement->fetchAll());
        Response::json(['data' => $data]);
    }

    if ($method === 'GET' && $path === '/v1/admin/metrics') {
        api_require_admin($pdo);
        $statusCounts = ['pending' => 0, 'active' => 0, 'rejected' => 0, 'archived' => 0];
        foreach ($pdo->query('SELECT status, COUNT(*) AS total FROM profiles GROUP BY status')->fetchAll() as $row) {
            $statusCounts[$row['status']] = (int) $row['total'];
        }
        $memberCount = (int) $pdo->query('SELECT COUNT(*) FROM members')->fetchColumn();
        $autoApproved = (int) $pdo->query('SELECT COUNT(*) FROM profiles WHERE auto_approved = 1')->fetchColumn();
        $todayProfiles = (int) $pdo->query('SELECT COUNT(*) FROM profiles WHERE created_at >= CURDATE()')->fetchColumn();
        $weekProfiles = (int) $pdo->query('SELECT COUNT(*) FROM profiles WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)')->fetchColumn();
        Response::json(['data' => ['profiles' => $statusCounts, 'members' => $memberCount, 'auto_approved' => $autoApproved, 'submitted_today' => $todayProfiles, 'submitted_last_7_days' => $weekProfiles, 'generated_at' => gmdate('c')]]);
    }

    if ($method === 'GET' && $path === '/v1/admin/members') {
        api_require_admin($pdo);
        $query = trim((string) ($_GET['q'] ?? ''));
        $sql = 'SELECT members.id, members.email, members.display_name, members.marketing_opt_in, members.created_at, members.updated_at, COUNT(profiles.id) AS profile_count, SUM(profiles.status = "active") AS active_profile_count, MAX(profiles.updated_at) AS last_profile_at FROM members LEFT JOIN profiles ON profiles.member_id = members.id';
        $params = [];
        if ($query !== '') { $sql .= ' WHERE members.email LIKE :query OR members.display_name LIKE :query'; $params['query'] = '%' . $query . '%'; }
        $sql .= ' GROUP BY members.id ORDER BY members.created_at DESC LIMIT 100';
        $statement = $pdo->prepare($sql); $statement->execute($params);
        $data = array_map(static fn(array $member): array => ['id' => (int) $member['id'], 'email' => $member['email'], 'display_name' => $member['display_name'] ?? '', 'marketing_opt_in' => (bool) $member['marketing_opt_in'], 'created_at' => $member['created_at'], 'updated_at' => $member['updated_at'], 'profile_count' => (int) $member['profile_count'], 'active_profile_count' => (int) $member['active_profile_count'], 'last_profile_at' => $member['last_profile_at']], $statement->fetchAll());
        Response::json(['data' => $data]);
    }

    if ($method === 'PATCH' && preg_match('#^/v1/admin/members/(\d+)$#', $path, $matches)) {
        api_validate_same_origin(); $admin = api_require_admin($pdo); $body = api_json_body();
        $displayName = trim((string) ($body['display_name'] ?? ''));
        if (mb_strlen($displayName) > 80) Response::error('Nome de exibição muito longo.', 422);
        $marketingOptIn = !empty($body['marketing_opt_in']) ? 1 : 0;
        $statement = $pdo->prepare('UPDATE members SET display_name = :display_name, marketing_opt_in = :marketing_opt_in WHERE id = :id');
        $statement->execute(['display_name' => $displayName ?: null, 'marketing_opt_in' => $marketingOptIn, 'id' => (int) $matches[1]]);
        if ($statement->rowCount() === 0) { $exists = $pdo->prepare('SELECT id FROM members WHERE id = :id'); $exists->execute(['id' => (int) $matches[1]]); if (!$exists->fetch()) Response::error('Usuário não encontrado.', 404); }
        api_audit($pdo, (int) $admin['id'], 'member_updated', null, ['member_id' => (int) $matches[1]]);
        Response::json(['data' => ['updated' => true]]);
    }

    if ($method === 'GET' && $path === '/v1/admin/profiles') {
        api_require_admin($pdo);
        $status = (string) ($_GET['status'] ?? 'pending');
        $query = trim((string) ($_GET['q'] ?? ''));
        $allowedStatuses = ['pending', 'active', 'rejected', 'archived'];
        if ($status !== 'all' && !in_array($status, $allowedStatuses, true)) {
            Response::error('Filtro de status inválido.', 422);
        }
        $sql = 'SELECT profiles.*, members.email AS member_email FROM profiles LEFT JOIN members ON members.id = profiles.member_id';
        $params = [];
        $where = [];
        if ($status !== 'all') { $where[] = 'profiles.status = :status'; $params['status'] = $status; }
        if ($query !== '') { $where[] = '(profiles.display_name LIKE :query OR profiles.city LIKE :query OR profiles.contact_phone LIKE :query OR members.email LIKE :query)'; $params['query'] = '%' . $query . '%'; }
        if ($where !== []) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY profiles.created_at DESC LIMIT 100';
        $statement = $pdo->prepare($sql); $statement->execute($params);
        $profiles = $statement->fetchAll();
        $photoStatement = $pdo->prepare('SELECT path FROM profile_photos WHERE profile_id = :profile_id ORDER BY position ASC');
        $data = [];
        foreach ($profiles as $profile) {
            $photoStatement->execute(['profile_id' => $profile['id']]);
            $data[] = api_admin_profile_output($profile, $photoStatement->fetchAll());
        }
        Response::json(['data' => $data]);
    }

    if ($method === 'PATCH' && preg_match('#^/v1/admin/profiles/([a-f0-9-]{36})$#i', $path, $matches)) {
        api_validate_same_origin();
        $admin = api_require_admin($pdo);
        $body = api_json_body();
        $allowedStatuses = ['pending', 'active', 'rejected', 'archived'];
        $status = $body['status'] ?? null;
        $moderationNote = trim((string) ($body['moderation_note'] ?? ''));
        if (!is_string($status) || !in_array($status, $allowedStatuses, true)) {
            Response::error('Status inválido.', 422);
        }
        if (mb_strlen($moderationNote) > 2000) {
            Response::error('A observação de moderação é muito longa.', 422);
        }
        $isFeatured = !empty($body['is_featured']) && $status === 'active' ? 1 : 0;
        $autoApproved = !empty($body['auto_approved']) ? 1 : 0;
        $profileEdit = is_array($body['profile'] ?? null) ? $body['profile'] : [];
        $editName = array_key_exists('name', $profileEdit) ? trim((string) $profileEdit['name']) : null;
        $editCity = array_key_exists('city', $profileEdit) ? trim((string) $profileEdit['city']) : null;
        $editNeighborhood = array_key_exists('neighborhood', $profileEdit) ? trim((string) $profileEdit['neighborhood']) : null;
        $editPrice = array_key_exists('price', $profileEdit) ? trim((string) $profileEdit['price']) : null;
        $editPhone = array_key_exists('contact_phone', $profileEdit) ? trim((string) $profileEdit['contact_phone']) : null;
        $editAvailability = array_key_exists('availability', $profileEdit) ? trim((string) $profileEdit['availability']) : null;
        $editDescription = array_key_exists('description', $profileEdit) ? trim((string) $profileEdit['description']) : null;
        if (($editName !== null && ($editName === '' || mb_strlen($editName) > 80)) || ($editCity !== null && ($editCity === '' || mb_strlen($editCity) > 120)) || ($editPrice !== null && ($editPrice === '' || mb_strlen($editPrice) > 80)) || ($editPhone !== null && (mb_strlen($editPhone) < 8 || mb_strlen($editPhone) > 40)) || ($editNeighborhood !== null && mb_strlen($editNeighborhood) > 120) || ($editAvailability !== null && mb_strlen($editAvailability) > 160) || ($editDescription !== null && mb_strlen($editDescription) > 2000)) Response::error('Verifique os dados editados do perfil.', 422);

        $statement = $pdo->prepare('UPDATE profiles SET status = :status, is_featured = :is_featured, auto_approved = :auto_approved, moderation_note = :moderation_note, display_name = COALESCE(:name, display_name), city = COALESCE(:city, city), neighborhood = COALESCE(:neighborhood, neighborhood), price_label = COALESCE(:price, price_label), contact_phone = COALESCE(:phone, contact_phone), availability = COALESCE(:availability, availability), description = COALESCE(:description, description) WHERE id = :id');
        $statement->execute(['status' => $status, 'is_featured' => $isFeatured, 'auto_approved' => $autoApproved, 'moderation_note' => $moderationNote ?: null, 'name' => $editName, 'city' => $editCity, 'neighborhood' => $editNeighborhood, 'price' => $editPrice, 'phone' => $editPhone, 'availability' => $editAvailability, 'description' => $editDescription, 'id' => $matches[1]]);
        if ($statement->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM profiles WHERE id = :id LIMIT 1');
            $exists->execute(['id' => $matches[1]]);
            if (!$exists->fetch()) {
                Response::error('Perfil não encontrado.', 404);
            }
        }

        api_audit($pdo, (int) $admin['id'], 'profile_moderated', $matches[1], [
            'status' => $status,
            'is_featured' => (bool) $isFeatured,
            'auto_approved' => (bool) $autoApproved,
            'edited' => $profileEdit !== [],
            'has_moderation_note' => $moderationNote !== '',
        ]);

        $profileStatement = $pdo->prepare('SELECT * FROM profiles WHERE id = :id LIMIT 1');
        $profileStatement->execute(['id' => $matches[1]]);
        $profile = $profileStatement->fetch();
        $photoStatement = $pdo->prepare('SELECT path FROM profile_photos WHERE profile_id = :profile_id ORDER BY position ASC');
        $photoStatement->execute(['profile_id' => $matches[1]]);
        Response::json(['data' => api_admin_profile_output($profile, $photoStatement->fetchAll())]);
    }

    // TheSex Club: public discovery returns only approved creators and posts.
    if ($method === 'GET' && $path === '/v1/club/creators') {
        $statement = $pdo->query("SELECT c.*, p.category, p.city, p.display_name AS profile_name, (SELECT pp.path FROM profile_photos pp WHERE pp.profile_id = c.profile_id ORDER BY pp.position ASC LIMIT 1) AS cover_photo FROM club_creators c INNER JOIN profiles p ON p.id = c.profile_id WHERE c.status = 'active' AND p.status = 'active' ORDER BY c.created_at DESC LIMIT 100");
        Response::json(['data' => array_map('api_club_creator_output', $statement->fetchAll())]);
    }

    if ($method === 'GET' && preg_match('#^/v1/club/creators/([a-z0-9][a-z0-9-]{2,48})$#', $path, $matches)) {
        $statement = $pdo->prepare("SELECT c.*, p.category, p.city, p.display_name AS profile_name, (SELECT pp.path FROM profile_photos pp WHERE pp.profile_id = c.profile_id ORDER BY pp.position ASC LIMIT 1) AS cover_photo FROM club_creators c INNER JOIN profiles p ON p.id = c.profile_id WHERE c.username = :username AND c.status = 'active' AND p.status = 'active' LIMIT 1");
        $statement->execute(['username' => $matches[1]]);
        $creator = $statement->fetch();
        if (!$creator) {
            Response::error('Canal não encontrado.', 404);
        }
        Response::json(['data' => api_club_creator_output($creator)]);
    }

    if ($method === 'GET' && preg_match('#^/v1/club/creators/([a-z0-9][a-z0-9-]{2,48})/posts$#', $path, $matches)) {
        $statement = $pdo->prepare("SELECT cp.*, cc.username AS creator_username, cc.display_name AS creator_name FROM club_posts cp INNER JOIN club_creators cc ON cc.id = cp.creator_id WHERE cc.username = :username AND cc.status = 'active' AND cp.status = 'published' AND cp.visibility = 'public' ORDER BY cp.published_at DESC LIMIT 100");
        $statement->execute(['username' => $matches[1]]);
        Response::json(['data' => array_map('api_club_post_output', $statement->fetchAll())]);
    }

    if ($method === 'GET' && $path === '/v1/club/feed') {
        $statement = $pdo->query("SELECT cp.*, cc.username AS creator_username, cc.display_name AS creator_name FROM club_posts cp INNER JOIN club_creators cc ON cc.id = cp.creator_id WHERE cc.status = 'active' AND cp.status = 'published' AND cp.visibility = 'public' ORDER BY cp.published_at DESC LIMIT 100");
        Response::json(['data' => array_map('api_club_post_output', $statement->fetchAll())]);
    }

    if ($method === 'POST' && $path === '/v1/club/events') {
        api_validate_same_origin();
        $body = api_json_body();
        $type = trim((string) ($body['event_type'] ?? ''));
        $creatorId = trim((string) ($body['creator_id'] ?? ''));
        $postId = trim((string) ($body['post_id'] ?? ''));
        if (!in_array($type, ['creator_viewed', 'post_opened', 'subscribe_intent', 'ppv_intent'], true) || ($creatorId !== '' && !preg_match('/^[a-f0-9-]{36}$/i', $creatorId)) || ($postId !== '' && !preg_match('/^[a-f0-9-]{36}$/i', $postId))) {
            Response::error('Evento inválido.', 422);
        }
        $member = api_optional_member($pdo);
        $statement = $pdo->prepare('INSERT INTO club_events (creator_id, post_id, member_id, event_type, metadata) VALUES (:creator_id, :post_id, :member_id, :event_type, NULL)');
        $statement->execute(['creator_id' => $creatorId ?: null, 'post_id' => $postId ?: null, 'member_id' => $member['id'] ?? null, 'event_type' => $type]);
        Response::json(['data' => ['recorded' => true]], 201);
    }

    // A Club channel belongs to an approved profile owned by the signed-in member.
    if ($method === 'POST' && $path === '/v1/member/club/creators') {
        api_validate_same_origin();
        $member = api_require_member($pdo);
        $body = api_json_body();
        $profileId = trim((string) ($body['profile_id'] ?? ''));
        $username = strtolower(trim((string) ($body['username'] ?? '')));
        $displayName = trim((string) ($body['display_name'] ?? ''));
        $bio = trim((string) ($body['bio'] ?? ''));
        $price = filter_var($body['monthly_price_cents'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 999999]]);
        if (!preg_match('/^[a-f0-9-]{36}$/i', $profileId) || !preg_match('/^[a-z0-9][a-z0-9-]{2,48}$/', $username) || $displayName === '' || mb_strlen($displayName) > 80 || mb_strlen($bio) > 1000 || $price === false) {
            Response::error('Revise os dados do canal.', 422);
        }
        $profile = $pdo->prepare("SELECT id FROM profiles WHERE id = :id AND member_id = :member_id AND status = 'active' LIMIT 1");
        $profile->execute(['id' => $profileId, 'member_id' => $member['id']]);
        if (!$profile->fetch()) {
            Response::error('Escolha um perfil aprovado da sua conta.', 422);
        }
        try {
            $creatorId = api_uuid();
            $statement = $pdo->prepare('INSERT INTO club_creators (id, member_id, profile_id, username, display_name, bio, monthly_price_cents) VALUES (:id, :member_id, :profile_id, :username, :display_name, :bio, :price)');
            $statement->execute(['id' => $creatorId, 'member_id' => $member['id'], 'profile_id' => $profileId, 'username' => $username, 'display_name' => $displayName, 'bio' => $bio ?: null, 'price' => $price]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                Response::error('Este perfil ou nome de canal já está em uso.', 409);
            }
            throw $exception;
        }
        Response::json(['data' => ['id' => $creatorId, 'status' => 'pending']], 201);
    }

    if ($method === 'GET' && $path === '/v1/member/club/dashboard') {
        $member = api_require_member($pdo);
        $statement = $pdo->prepare('SELECT * FROM club_creators WHERE member_id = :member_id ORDER BY created_at DESC');
        $statement->execute(['member_id' => $member['id']]);
        $channels = $statement->fetchAll();
        $postCount = $pdo->prepare('SELECT COUNT(*) FROM club_posts cp INNER JOIN club_creators cc ON cc.id = cp.creator_id WHERE cc.member_id = :member_id');
        $postCount->execute(['member_id' => $member['id']]);
        Response::json(['data' => ['channels' => array_map('api_club_creator_output', $channels), 'post_count' => (int) $postCount->fetchColumn()]]);
    }

    if ($method === 'POST' && $path === '/v1/member/club/posts') {
        api_validate_same_origin();
        $member = api_require_member($pdo);
        $body = api_json_body();
        $creatorId = trim((string) ($body['creator_id'] ?? ''));
        $caption = trim((string) ($body['caption'] ?? ''));
        $visibility = trim((string) ($body['visibility'] ?? 'subscribers'));
        $price = filter_var($body['price_cents'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 999999]]);
        $media = $body['media'] ?? [];
        if (!preg_match('/^[a-f0-9-]{36}$/i', $creatorId) || $caption === '' || mb_strlen($caption) > 2200 || !in_array($visibility, ['public', 'subscribers', 'ppv'], true) || $price === false || !is_array($media) || count($media) > 12) {
            Response::error('Revise os dados da publicação.', 422);
        }
        if ($visibility === 'ppv' && $price < 100) {
            Response::error('Publicações avulsas precisam ter valor mínimo de R$ 1,00.', 422);
        }
        foreach ($media as $item) {
            if (!is_string($item) || mb_strlen($item) > 255) {
                Response::error('Mídia inválida.', 422);
            }
        }
        $creator = $pdo->prepare('SELECT id FROM club_creators WHERE id = :id AND member_id = :member_id LIMIT 1');
        $creator->execute(['id' => $creatorId, 'member_id' => $member['id']]);
        if (!$creator->fetch()) {
            Response::error('Canal não encontrado.', 404);
        }
        $postId = api_uuid();
        $statement = $pdo->prepare("INSERT INTO club_posts (id, creator_id, caption, visibility, price_cents, media, status) VALUES (:id, :creator_id, :caption, :visibility, :price, :media, 'pending')");
        $statement->execute(['id' => $postId, 'creator_id' => $creatorId, 'caption' => $caption, 'visibility' => $visibility, 'price' => $price, 'media' => json_encode(array_values($media), JSON_UNESCAPED_UNICODE)]);
        Response::json(['data' => ['id' => $postId, 'status' => 'pending']], 201);
    }

    if ($method === 'GET' && $path === '/v1/admin/club/overview') {
        api_require_admin($pdo);
        Response::json(['data' => [
            'creators' => (int) $pdo->query("SELECT COUNT(*) FROM club_creators WHERE status = 'active'")->fetchColumn(),
            'creator_queue' => (int) $pdo->query("SELECT COUNT(*) FROM club_creators WHERE status = 'pending'")->fetchColumn(),
            'posts' => (int) $pdo->query("SELECT COUNT(*) FROM club_posts WHERE status = 'published'")->fetchColumn(),
            'post_queue' => (int) $pdo->query("SELECT COUNT(*) FROM club_posts WHERE status = 'pending'")->fetchColumn(),
            'paid_orders' => (int) $pdo->query("SELECT COUNT(*) FROM club_orders WHERE status = 'paid'")->fetchColumn(),
            'revenue_cents' => (int) $pdo->query("SELECT COALESCE(SUM(amount_cents), 0) FROM club_orders WHERE status = 'paid'")->fetchColumn(),
        ]]);
    }

    if ($method === 'GET' && $path === '/v1/admin/club/creators') {
        api_require_admin($pdo);
        $statement = $pdo->query("SELECT c.*, p.category, p.city, p.display_name AS profile_name, (SELECT pp.path FROM profile_photos pp WHERE pp.profile_id = c.profile_id ORDER BY pp.position ASC LIMIT 1) AS cover_photo FROM club_creators c INNER JOIN profiles p ON p.id = c.profile_id ORDER BY FIELD(c.status, 'pending', 'active', 'paused', 'rejected'), c.created_at DESC LIMIT 200");
        Response::json(['data' => array_map('api_club_creator_output', $statement->fetchAll())]);
    }

    if ($method === 'PATCH' && preg_match('#^/v1/admin/club/creators/([a-f0-9-]{36})$#i', $path, $matches)) {
        api_validate_same_origin();
        $admin = api_require_admin($pdo);
        $status = (string) (api_json_body()['status'] ?? '');
        if (!in_array($status, ['pending', 'active', 'paused', 'rejected'], true)) {
            Response::error('Status de canal inválido.', 422);
        }
        $statement = $pdo->prepare('UPDATE club_creators SET status = :status WHERE id = :id');
        $statement->execute(['status' => $status, 'id' => $matches[1]]);
        if ($statement->rowCount() === 0) {
            Response::error('Canal não encontrado.', 404);
        }
        api_audit($pdo, (int) $admin['id'], 'club_creator_moderated', null, ['creator_id' => $matches[1], 'status' => $status]);
        Response::json(['data' => ['id' => $matches[1], 'status' => $status]]);
    }

    if ($method === 'GET' && $path === '/v1/admin/club/posts') {
        api_require_admin($pdo);
        $statement = $pdo->query("SELECT cp.*, cc.username AS creator_username, cc.display_name AS creator_name FROM club_posts cp INNER JOIN club_creators cc ON cc.id = cp.creator_id ORDER BY FIELD(cp.status, 'pending', 'draft', 'published', 'archived'), cp.created_at DESC LIMIT 300");
        Response::json(['data' => array_map('api_club_post_output', $statement->fetchAll())]);
    }

    if ($method === 'PATCH' && preg_match('#^/v1/admin/club/posts/([a-f0-9-]{36})$#i', $path, $matches)) {
        api_validate_same_origin();
        $admin = api_require_admin($pdo);
        $status = (string) (api_json_body()['status'] ?? '');
        if (!in_array($status, ['draft', 'pending', 'published', 'archived'], true)) {
            Response::error('Status de publicação inválido.', 422);
        }
        $statement = $pdo->prepare("UPDATE club_posts SET status = :status, published_at = CASE WHEN :status = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE published_at END WHERE id = :id");
        $statement->execute(['status' => $status, 'id' => $matches[1]]);
        if ($statement->rowCount() === 0) {
            Response::error('Publicação não encontrada.', 404);
        }
        api_audit($pdo, (int) $admin['id'], 'club_post_moderated', null, ['post_id' => $matches[1], 'status' => $status]);
        Response::json(['data' => ['id' => $matches[1], 'status' => $status]]);
    }

    if ($method === 'GET' && $path === '/v1/admin/club/orders') {
        api_require_admin($pdo);
        $statement = $pdo->query("SELECT co.id, co.kind, co.amount_cents, co.currency, co.status, co.created_at, cc.username AS creator_username, m.email AS member_email FROM club_orders co INNER JOIN club_creators cc ON cc.id = co.creator_id INNER JOIN members m ON m.id = co.member_id ORDER BY co.created_at DESC LIMIT 300");
        Response::json(['data' => $statement->fetchAll()]);
    }

    if ($method === 'GET' && $path === '/v1/profiles') {
        $query = trim((string) ($_GET['q'] ?? ''));
        $city = trim((string) ($_GET['city'] ?? ''));
        $category = trim((string) ($_GET['category'] ?? ''));
        $sql = 'SELECT * FROM profiles WHERE status = "active"';
        $params = [];

        if ($query !== '') {
            $sql .= ' AND (display_name LIKE :query OR city LIKE :query OR neighborhood LIKE :query OR category LIKE :query OR description LIKE :query)';
            $params['query'] = '%' . $query . '%';
        }
        if ($city !== '') {
            $sql .= ' AND city = :city';
            $params['city'] = $city;
        }
        if ($category !== '') {
            $sql .= ' AND category = :category';
            $params['category'] = $category;
        }
        $sql .= ' ORDER BY is_featured DESC, created_at DESC LIMIT 100';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        $profiles = $statement->fetchAll();

        $photoStatement = $pdo->prepare('SELECT path FROM profile_photos WHERE profile_id = :profile_id ORDER BY position ASC');
        $data = [];
        foreach ($profiles as $profile) {
            $photoStatement->execute(['profile_id' => $profile['id']]);
            $data[] = api_profile_output($profile, $photoStatement->fetchAll());
        }
        Response::json(['data' => $data]);
    }

    if ($method === 'GET' && preg_match('#^/v1/profiles/([^/]+)$#i', $path, $matches)) {
        $identifier = strtolower($matches[1]);
        if (preg_match('/^[a-f0-9-]{36}$/', $identifier)) {
            $statement = $pdo->prepare('SELECT * FROM profiles WHERE id = :id AND status = "active" LIMIT 1');
            $statement->execute(['id' => $identifier]);
        } elseif (preg_match('/([a-f0-9]{12})$/', $identifier, $suffix)) {
            $statement = $pdo->prepare('SELECT * FROM profiles WHERE REPLACE(id, "-", "") LIKE :suffix AND status = "active" LIMIT 1');
            $statement->execute(['suffix' => '%' . $suffix[1]]);
        } else {
            Response::error('Perfil não encontrado.', 404);
        }
        $profile = $statement->fetch();
        if (!$profile) {
            Response::error('Perfil não encontrado.', 404);
        }
        $photoStatement = $pdo->prepare('SELECT path FROM profile_photos WHERE profile_id = :profile_id ORDER BY position ASC');
        $photoStatement->execute(['profile_id' => $profile['id']]);
        Response::json(['data' => api_profile_output($profile, $photoStatement->fetchAll())]);
    }

    if ($method === 'POST' && $path === '/v1/profiles') {
        api_validate_same_origin();
        $member = api_optional_member($pdo);
        $name = trim((string) ($_POST['name'] ?? ''));
        $age = filter_var($_POST['age'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 18, 'max_range' => 99]]);
        $city = trim((string) ($_POST['city'] ?? ''));
        $category = trim((string) ($_POST['category'] ?? 'Acompanhante'));
        $neighborhood = trim((string) ($_POST['neighborhood'] ?? ''));
        $price = trim((string) ($_POST['price'] ?? ''));
        $contactPhone = trim((string) ($_POST['contact_phone'] ?? ''));
        $availability = trim((string) ($_POST['availability'] ?? ''));
        $description = trim((string) ($_POST['description'] ?? ''));
        $tags = json_decode((string) ($_POST['tags'] ?? '[]'), true);
        $services = json_decode((string) ($_POST['services'] ?? '[]'), true);
        $serviceFor = json_decode((string) ($_POST['service_for'] ?? '[]'), true);
        $meetingPlaces = json_decode((string) ($_POST['meeting_places'] ?? '[]'), true);
        $paymentMethods = json_decode((string) ($_POST['payment_methods'] ?? '[]'), true);
        $honeypot = trim((string) ($_POST['website'] ?? ''));

        if ($honeypot !== '') {
            Response::json(['message' => 'Solicitação recebida.'], 201);
        }
        $allowedCategories = ['Acompanhante', 'Massagem', 'Trans e Travesti', 'Encontro casual'];
        $profileLists = [$tags, $services, $serviceFor, $meetingPlaces, $paymentMethods];
        $invalidList = array_filter($profileLists, static function ($list): bool {
            if (!is_array($list) || count($list) > 12) {
                return true;
            }
            foreach ($list as $value) {
                if (!is_string($value) || mb_strlen($value) > 60) {
                    return true;
                }
            }
            return false;
        });
        if ($name === '' || mb_strlen($name) > 80 || !$age || $city === '' || mb_strlen($city) > 120 || !in_array($category, $allowedCategories, true) || mb_strlen($neighborhood) > 120 || $price === '' || mb_strlen($price) > 80 || mb_strlen($contactPhone) < 8 || mb_strlen($contactPhone) > 40 || mb_strlen($availability) > 160 || mb_strlen($description) > 2000 || $invalidList !== [] || ($_POST['adult_confirmed'] ?? '') !== 'true') {
            Response::error('Verifique os campos obrigatórios do perfil.', 422);
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $ipHash = hash('sha256', $ip . (Config::get('DB_PASSWORD') ?? ''));
        // A member may operate any number of distinct public profiles. The form
        // disables repeated submissions while uploading, so there is no IP-wide
        // cooldown that could block legitimate profiles on the same connection.

        $files = $_FILES['photos'] ?? null;
        $photoCount = is_array($files['name'] ?? null) ? count($files['name']) : 0;
        if ($photoCount < 1 || $photoCount > 5) {
            Response::error('Envie entre 1 e 5 fotos.', 422);
        }

        $id = api_uuid();
        $uploadDirectory = __DIR__ . '/uploads/profiles/' . $id;
        if (!mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
            throw new RuntimeException('Não foi possível preparar o armazenamento de fotos.');
        }

        $allowedTypes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $paths = [];
        try {
            for ($index = 0; $index < $photoCount; $index++) {
                if (($files['error'][$index] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || ($files['size'][$index] ?? 0) > 5 * 1024 * 1024) {
                    throw new RuntimeException('Cada foto deve ter no máximo 5 MB.');
                }
                $mime = $finfo->file($files['tmp_name'][$index]);
                if (!isset($allowedTypes[$mime])) {
                    throw new RuntimeException('Envie apenas imagens JPG, PNG ou WEBP.');
                }
                $filename = ($index + 1) . '.' . $allowedTypes[$mime];
                if (!move_uploaded_file($files['tmp_name'][$index], $uploadDirectory . '/' . $filename)) {
                    throw new RuntimeException('Não foi possível salvar uma das fotos.');
                }
                $paths[] = 'uploads/profiles/' . $id . '/' . $filename;
            }

            $pdo->beginTransaction();
            $profile = $pdo->prepare('INSERT INTO profiles (id, member_id, display_name, age, category, city, neighborhood, price_label, contact_phone, availability, services, service_for, meeting_places, payment_methods, description, tags, submitted_ip_hash) VALUES (:id, :member_id, :name, :age, :category, :city, :neighborhood, :price, :contact_phone, :availability, :services, :service_for, :meeting_places, :payment_methods, :description, :tags, :ip_hash)');
            $profile->execute(['id' => $id, 'member_id' => $member['id'] ?? null, 'name' => $name, 'age' => $age, 'category' => $category, 'city' => $city, 'neighborhood' => $neighborhood ?: null, 'price' => $price, 'contact_phone' => $contactPhone, 'availability' => $availability ?: null, 'services' => json_encode(array_values($services), JSON_UNESCAPED_UNICODE), 'service_for' => json_encode(array_values($serviceFor), JSON_UNESCAPED_UNICODE), 'meeting_places' => json_encode(array_values($meetingPlaces), JSON_UNESCAPED_UNICODE), 'payment_methods' => json_encode(array_values($paymentMethods), JSON_UNESCAPED_UNICODE), 'description' => $description, 'tags' => json_encode(array_values($tags), JSON_UNESCAPED_UNICODE), 'ip_hash' => $ipHash]);
            $photo = $pdo->prepare('INSERT INTO profile_photos (profile_id, path, position) VALUES (:profile_id, :path, :position)');
            foreach ($paths as $position => $filePath) {
                $photo->execute(['profile_id' => $id, 'path' => $filePath, 'position' => $position]);
            }
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            foreach ($paths as $filePath) {
                @unlink(__DIR__ . '/' . $filePath);
            }
            @rmdir($uploadDirectory);
            throw $exception;
        }

        Response::json(['message' => 'Perfil enviado para análise.'], 201);
    }

    Response::error('Rota não encontrada.', 404);
} catch (Throwable $exception) {
    error_log('[thesex-api] ' . $exception->getMessage());
    Response::error('Não foi possível concluir esta solicitação.', 500);
}
