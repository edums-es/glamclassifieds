<?php

declare(strict_types=1);

const INSTALL_ROOT = __DIR__ . '/..';
const INSTALL_LOCK = INSTALL_ROOT . '/api/.installed';

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

if (is_file(INSTALL_LOCK)) {
    http_response_code(404);
    exit('Instalador indisponível.');
}

session_name('thesex_install');
session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Strict',
    'cookie_secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
]);

$_SESSION['install_csrf'] ??= bin2hex(random_bytes(32));
$error = '';
$success = false;
$values = [
    'app_url' => 'https://' . ($_SERVER['HTTP_HOST'] ?? 'thesex.online'),
    'db_host' => 'localhost',
    'db_port' => '3306',
    'db_database' => '',
    'db_username' => '',
    'admin_email' => '',
];

function install_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function install_write_file(string $file, string $contents, int $permissions): void
{
    $temporary = $file . '.tmp';
    if (file_put_contents($temporary, $contents, LOCK_EX) === false || !rename($temporary, $file)) {
        @unlink($temporary);
        throw new RuntimeException('Não foi possível gravar os arquivos de configuração. Verifique as permissões de api/.');
    }
    @chmod($file, $permissions);
}

function install_has_line_break(string $value): bool
{
    return str_contains($value, "\n") || str_contains($value, "\r");
}

function install_schema(PDO $pdo): void
{
    $schema = file_get_contents(INSTALL_ROOT . '/database/schema.sql');
    if ($schema === false) {
        throw new RuntimeException('O arquivo database/schema.sql não foi encontrado.');
    }

    $statements = preg_split('/;\s*(?:\r?\n|$)/', $schema) ?: [];
    foreach ($statements as $statement) {
        $statement = trim($statement);
        if ($statement !== '') {
            $pdo->exec($statement);
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach (array_keys($values) as $key) {
        if (isset($_POST[$key])) {
            $values[$key] = trim((string) $_POST[$key]);
        }
    }
    $dbPassword = (string) ($_POST['db_password'] ?? '');
    $adminPassword = (string) ($_POST['admin_password'] ?? '');

    try {
        if (!hash_equals($_SESSION['install_csrf'], (string) ($_POST['csrf'] ?? ''))) {
            throw new RuntimeException('Sessão inválida. Atualize a página e tente novamente.');
        }
        if (install_has_line_break($values['app_url']) || !filter_var($values['app_url'], FILTER_VALIDATE_URL) || !str_starts_with($values['app_url'], 'https://')) {
            throw new RuntimeException('Informe uma URL HTTPS válida para o site.');
        }
        if (!preg_match('/^[a-zA-Z0-9.-]+$/', $values['db_host']) || !ctype_digit($values['db_port']) || !preg_match('/^[a-zA-Z0-9_]+$/', $values['db_database']) || !preg_match('/^[a-zA-Z0-9_]+$/', $values['db_username']) || $dbPassword === '' || install_has_line_break($dbPassword)) {
            throw new RuntimeException('Preencha todos os dados do banco de dados.');
        }
        if (!filter_var($values['admin_email'], FILTER_VALIDATE_EMAIL) || strlen($adminPassword) < 12) {
            throw new RuntimeException('Use um e-mail válido e uma senha administrativa de pelo menos 12 caracteres.');
        }
        if (!extension_loaded('pdo_mysql')) {
            throw new RuntimeException('A extensão pdo_mysql não está habilitada no PHP desta hospedagem.');
        }
        if (!is_writable(INSTALL_ROOT . '/api')) {
            throw new RuntimeException('A pasta api/ não tem permissão de escrita. Ajuste para 755 e tente novamente.');
        }

        $pdo = new PDO(
            "mysql:host={$values['db_host']};port={$values['db_port']};dbname={$values['db_database']};charset=utf8mb4",
            $values['db_username'],
            $dbPassword,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $hasAdmin = (bool) $pdo->query("SHOW TABLES LIKE 'admins'")->fetchColumn();
        if ($hasAdmin && (int) $pdo->query('SELECT COUNT(*) FROM admins')->fetchColumn() > 0) {
            throw new RuntimeException('Esse banco já possui uma instalação. Use um banco vazio ou mantenha a instalação atual.');
        }

        $environment = implode("\n", [
            'APP_ENV=production',
            'APP_URL=' . rtrim($values['app_url'], '/'),
            'DB_HOST=' . $values['db_host'],
            'DB_PORT=' . $values['db_port'],
            'DB_DATABASE=' . $values['db_database'],
            'DB_USERNAME=' . $values['db_username'],
            'DB_PASSWORD=' . $dbPassword,
            '',
        ]);
        install_write_file(INSTALL_ROOT . '/api/.env', $environment, 0600);

        $uploads = INSTALL_ROOT . '/api/uploads/profiles';
        if (!is_dir($uploads) && !mkdir($uploads, 0755, true) && !is_dir($uploads)) {
            throw new RuntimeException('Não foi possível preparar a pasta de uploads.');
        }
        install_schema($pdo);
        $admin = $pdo->prepare('INSERT INTO admins (email, password_hash) VALUES (:email, :password_hash)');
        $admin->execute([
            'email' => strtolower($values['admin_email']),
            'password_hash' => password_hash($adminPassword, PASSWORD_DEFAULT),
        ]);
        install_write_file(INSTALL_LOCK, 'Installed at ' . gmdate(DATE_ATOM) . "\n", 0600);
        session_destroy();
        $success = true;
    } catch (PDOException $exception) {
        error_log('[thesex-install] ' . $exception->getMessage());
        $error = 'Não foi possível acessar ou preparar o banco. Confira host, porta, nome, usuário e senha.';
    } catch (Throwable $exception) {
        error_log('[thesex-install] ' . $exception->getMessage());
        $error = $exception->getMessage();
    }
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Instalar TheSex</title>
  <style>
    body{margin:0;background:#f6f4f4;color:#231f20;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{max-width:620px;margin:48px auto;padding:32px;background:#fff;border:1px solid #e6dddd;border-radius:20px;box-shadow:0 14px 48px #2e111420}h1{margin:0;font-size:28px}p{line-height:1.55;color:#685d5f}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.full{grid-column:1/-1}label{display:grid;gap:6px;font-size:14px;font-weight:650}input{box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid #cfc4c6;border-radius:10px;font:inherit}button{margin-top:22px;width:100%;border:0;border-radius:999px;padding:13px;background:#6d2534;color:#fff;font:inherit;font-weight:700;cursor:pointer}.notice{margin:20px 0;padding:13px 15px;border-radius:10px}.error{background:#fff0f1;color:#9f2434}.success{background:#ecf9f0;color:#19663a}@media(max-width:620px){.card{margin:20px 14px;padding:24px}.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main class="card">
    <?php if ($success): ?>
      <h1>Instalação concluída</h1>
      <div class="notice success">O banco foi preparado, o administrador foi criado e o instalador foi bloqueado automaticamente.</div>
      <p>Agora acesse <a href="/admin">/admin</a> com o e-mail e senha definidos. Depois teste o envio de um perfil em <a href="/create">/create</a>.</p>
    <?php else: ?>
      <h1>Instalar TheSex</h1>
      <p>Use um banco MySQL novo criado no hPanel. Os dados informados serão gravados apenas em <code>api/.env</code>, que não entra no Git.</p>
      <?php if ($error !== ''): ?><div class="notice error"><?= install_escape($error) ?></div><?php endif; ?>
      <form method="post" autocomplete="off">
        <input type="hidden" name="csrf" value="<?= install_escape($_SESSION['install_csrf']) ?>">
        <div class="grid">
          <label class="full">URL do site<input name="app_url" type="url" required value="<?= install_escape($values['app_url']) ?>"></label>
          <label>Servidor do banco<input name="db_host" required value="<?= install_escape($values['db_host']) ?>"></label>
          <label>Porta<input name="db_port" inputmode="numeric" required value="<?= install_escape($values['db_port']) ?>"></label>
          <label>Nome do banco<input name="db_database" required value="<?= install_escape($values['db_database']) ?>"></label>
          <label>Usuário do banco<input name="db_username" required value="<?= install_escape($values['db_username']) ?>"></label>
          <label class="full">Senha do banco<input name="db_password" type="password" required></label>
          <label>Seu e-mail de administrador<input name="admin_email" type="email" required value="<?= install_escape($values['admin_email']) ?>"></label>
          <label>Senha do administrador<input name="admin_password" type="password" minlength="12" required></label>
        </div>
        <button type="submit">Instalar e criar administrador</button>
      </form>
    <?php endif; ?>
  </main>
</body>
</html>
