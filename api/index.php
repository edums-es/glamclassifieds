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
    return '/profile/' . api_slugify((string) $profile['display_name']) . '-' . api_slugify((string) $profile['city']) . '-' . $suffix;
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

    $profiles = $pdo->query("SELECT id, display_name, city, updated_at FROM profiles WHERE status = 'active' ORDER BY updated_at DESC LIMIT 50000");
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

function api_admin_profile_output(array $profile, array $photos): array
{
    return array_merge(api_profile_output($profile, $photos), [
        'status' => $profile['status'],
        'moderation_note' => $profile['moderation_note'] ?? '',
        'created_at' => $profile['created_at'],
        'updated_at' => $profile['updated_at'],
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
        $statement = $pdo->prepare('UPDATE profiles SET display_name = :name, age = :age, category = :category, city = :city, neighborhood = :neighborhood, price_label = :price, contact_phone = :contact_phone, availability = :availability, services = :services, service_for = :service_for, meeting_places = :meeting_places, payment_methods = :payment_methods, description = :description, tags = :tags, status = "pending", is_featured = 0, moderation_note = NULL WHERE id = :id AND member_id = :member_id');
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
        $statement = $pdo->prepare('UPDATE profiles SET status = :status, is_featured = 0 WHERE id = :id AND member_id = :member_id');
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

    if ($method === 'GET' && $path === '/v1/admin/profiles') {
        api_require_admin($pdo);
        $status = (string) ($_GET['status'] ?? 'pending');
        $allowedStatuses = ['pending', 'active', 'rejected', 'archived'];
        if (!in_array($status, $allowedStatuses, true)) {
            Response::error('Filtro de status inválido.', 422);
        }

        $statement = $pdo->prepare('SELECT * FROM profiles WHERE status = :status ORDER BY created_at DESC LIMIT 100');
        $statement->execute(['status' => $status]);
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

        $statement = $pdo->prepare('UPDATE profiles SET status = :status, is_featured = :is_featured, moderation_note = :moderation_note WHERE id = :id');
        $statement->execute(['status' => $status, 'is_featured' => $isFeatured, 'moderation_note' => $moderationNote ?: null, 'id' => $matches[1]]);
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
            'has_moderation_note' => $moderationNote !== '',
        ]);

        $profileStatement = $pdo->prepare('SELECT * FROM profiles WHERE id = :id LIMIT 1');
        $profileStatement->execute(['id' => $matches[1]]);
        $profile = $profileStatement->fetch();
        $photoStatement = $pdo->prepare('SELECT path FROM profile_photos WHERE profile_id = :profile_id ORDER BY position ASC');
        $photoStatement->execute(['profile_id' => $matches[1]]);
        Response::json(['data' => api_admin_profile_output($profile, $photoStatement->fetchAll())]);
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
        $limit = $pdo->prepare('SELECT last_submitted_at FROM submission_limits WHERE ip_hash = :ip_hash LIMIT 1');
        $limit->execute(['ip_hash' => $ipHash]);
        $lastSubmission = $limit->fetchColumn();
        if ($lastSubmission && strtotime((string) $lastSubmission) > strtotime('-24 hours')) {
            Response::error('Você já enviou um perfil recentemente. Aguarde a análise.', 429);
        }

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
            $pdo->prepare('INSERT INTO submission_limits (ip_hash) VALUES (:ip_hash) ON DUPLICATE KEY UPDATE last_submitted_at = CURRENT_TIMESTAMP')->execute(['ip_hash' => $ipHash]);
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
