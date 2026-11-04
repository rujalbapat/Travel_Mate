<?php
$host = 'localhost';
$dbName = 'travelmate_db';
$dbUser = 'root';
$dbPass = '';

try {
    $pdo = new PDO("mysql:host={$host};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
} catch (PDOException $e) {
    error_log('TravelMate database connection failed: ' . $e->getMessage());
    die('Database connection failed. Please make sure MySQL is running and the database has been imported.');
}
?>
