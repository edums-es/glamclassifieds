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
    return [
        'id' => $profile['id'],
        'name' => $profile['display_name'],
        'age' => (int) $profile['age'],
        'city' => $profile['city'],
        'price' => $profile['price_label'],
        'description' => $profile['description'] ?? '',
        'tags' => is_array($tags) ? array_values($tags) : [],
        'photos' => array_map(static fn(array $photo): string => '/api/' . ltrim($photo['path'], '/'), $photos),
        'is_featured' => (bool) $profile['is_featured'],
    ];
}

function api_admin_profile_output(array $profile, array $photos): array
{
    return array_merge(api_profile_output($profile, $photos), [
        'status' => $profile['status'],
        'created_at' => $profile['created_at'],
        'updated_at' => $profile['updated_at'],
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

    if (str_starts_with($path, '/v1/admin/')) {
        api_start_admin_session();
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
        api_require_admin($pdo);
        $body = api_json_body();
        $allowedStatuses = ['pending', 'active', 'rejected', 'archived'];
        $status = $body['status'] ?? null;
        if (!is_string($status) || !in_array($status, $allowedStatuses, true)) {
            Response::error('Status inválido.', 422);
        }
        $isFeatured = !empty($body['is_featured']) && $status === 'active' ? 1 : 0;

        $statement = $pdo->prepare('UPDATE profiles SET status = :status, is_featured = :is_featured WHERE id = :id');
        $statement->execute(['status' => $status, 'is_featured' => $isFeatured, 'id' => $matches[1]]);
        if ($statement->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM profiles WHERE id = :id LIMIT 1');
            $exists->execute(['id' => $matches[1]]);
            if (!$exists->fetch()) {
                Response::error('Perfil não encontrado.', 404);
            }
        }

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
        $sql = 'SELECT * FROM profiles WHERE status = "active"';
        $params = [];

        if ($query !== '') {
            $sql .= ' AND (display_name LIKE :query OR city LIKE :query OR description LIKE :query)';
            $params['query'] = '%' . $query . '%';
        }
        if ($city !== '') {
            $sql .= ' AND city = :city';
            $params['city'] = $city;
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

    if ($method === 'GET' && preg_match('#^/v1/profiles/([a-f0-9-]{36})$#i', $path, $matches)) {
        $statement = $pdo->prepare('SELECT * FROM profiles WHERE id = :id AND status = "active" LIMIT 1');
        $statement->execute(['id' => $matches[1]]);
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
        $name = trim((string) ($_POST['name'] ?? ''));
        $age = filter_var($_POST['age'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 18, 'max_range' => 99]]);
        $city = trim((string) ($_POST['city'] ?? ''));
        $price = trim((string) ($_POST['price'] ?? ''));
        $description = trim((string) ($_POST['description'] ?? ''));
        $tags = json_decode((string) ($_POST['tags'] ?? '[]'), true);
        $honeypot = trim((string) ($_POST['website'] ?? ''));

        if ($honeypot !== '') {
            Response::json(['message' => 'Solicitação recebida.'], 201);
        }
        if ($name === '' || mb_strlen($name) > 80 || !$age || $city === '' || mb_strlen($city) > 120 || $price === '' || mb_strlen($price) > 80 || mb_strlen($description) > 2000 || !is_array($tags) || count($tags) > 12) {
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
            $profile = $pdo->prepare('INSERT INTO profiles (id, display_name, age, city, price_label, description, tags, submitted_ip_hash) VALUES (:id, :name, :age, :city, :price, :description, :tags, :ip_hash)');
            $profile->execute(['id' => $id, 'name' => $name, 'age' => $age, 'city' => $city, 'price' => $price, 'description' => $description, 'tags' => json_encode(array_values($tags), JSON_UNESCAPED_UNICODE), 'ip_hash' => $ipHash]);
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
