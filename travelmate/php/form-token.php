<?php
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

$issuedTokens = $_SESSION['travelmate_form_tokens'] ?? [];
foreach ($issuedTokens as $tokenHash => $issuedAt) {
    if (!is_int($issuedAt) || $issuedAt < time() - 7200) {
        unset($issuedTokens[$tokenHash]);
    }
}
if (count($issuedTokens) >= 20) {
    asort($issuedTokens);
    $issuedTokens = array_slice($issuedTokens, -19, null, true);
}

$token = bin2hex(random_bytes(32));
$issuedTokens[hash('sha256', $token)] = time();
$_SESSION['travelmate_form_tokens'] = $issuedTokens;

echo json_encode(['token' => $token]);
