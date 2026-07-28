<?php

declare(strict_types=1);

namespace TheSex\Api;

use PDO;

final class Database
{
    public static function connect(): PDO
    {
        $host = Config::get('DB_HOST', 'localhost');
        $port = Config::get('DB_PORT', '3306');
        $database = Config::get('DB_DATABASE');
        $username = Config::get('DB_USERNAME');
        $password = Config::get('DB_PASSWORD');

        if (!$database || !$username) {
            throw new \RuntimeException('Database configuration is incomplete.');
        }

        return new PDO(
            "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4",
            $username,
            $password,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
}
