<?php

declare(strict_types=1);

use TheSex\Api\Config;
use TheSex\Api\Database;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

spl_autoload_register(static function (string $class): void {
    $prefix = 'TheSex\\Api\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $file = dirname(__DIR__) . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

[$script, $email, $password] = array_pad($argv, 3, '');
$email = strtolower(trim($email));

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12) {
    fwrite(STDERR, "Uso: php api/scripts/create_admin.php email@dominio.com senha-com-no-minimo-12-caracteres\n");
    exit(1);
}

try {
    Config::load(dirname(__DIR__) . '/.env');
    $pdo = Database::connect();
    $statement = $pdo->prepare('INSERT INTO admins (email, password_hash) VALUES (:email, :password_hash)');
    $statement->execute([
        'email' => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    ]);
    fwrite(STDOUT, "Administrador criado com sucesso.\n");
} catch (Throwable $exception) {
    fwrite(STDERR, "Não foi possível criar o administrador: {$exception->getMessage()}\n");
    exit(1);
}
