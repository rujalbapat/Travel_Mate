<?php
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
]);
session_start();

function postText(string $key): string
{
    $value = $_POST[$key] ?? '';
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        return '';
    }

    $trimmed = preg_replace('/^\s+|\s+$/u', '', $value);
    return $trimmed === null ? '' : $trimmed;
}

function textLength(string $value): int
{
    return mb_strlen($value, 'UTF-8');
}

function renderContactError(string $message): void
{
    $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Contact Error</title><link rel="stylesheet" href="../css/style.css" /></head><body class="booking-success-page"><main class="success-page"><section class="success-card" aria-live="polite"><div class="success-icon" aria-hidden="true">!</div><h1>Message could not be sent</h1><p class="success-message">Please review the contact form and try again.</p><div class="success-details"><p>' . $safeMessage . '</p></div><div class="success-actions"><a class="form-button" href="../contact.html">Back to Contact</a><a class="secondary-btn" href="../index.html">Back to Home</a></div></section></main></body></html>';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    renderContactError('Invalid request method.');
}

$submittedToken = is_string($_POST['csrf_token'] ?? null) ? $_POST['csrf_token'] : '';
$tokenHash = hash('sha256', $submittedToken);
$tokenIssuedAt = $_SESSION['travelmate_form_tokens'][$tokenHash] ?? null;
if ($submittedToken === '' || !is_int($tokenIssuedAt) || $tokenIssuedAt < time() - 7200) {
    renderContactError('The form expired or could not be verified. Reload the contact page and try again.');
}
if (postText('website') !== '') {
    renderContactError('Message could not be submitted. Please try again.');
}

$name = postText('name');
$email = postText('email');
$subject = postText('subject');
$message = postText('message');

$errors = [];

if ($name === '' || textLength($name) > 150) {
    $errors[] = 'Name is required and must be 150 characters or fewer.';
}
if ($email === '' || textLength($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Please enter a valid email address.';
}
if ($subject === '' || textLength($subject) > 200) {
    $errors[] = 'Subject is required and must be 200 characters or fewer.';
}
if ($message === '' || textLength($message) < 10 || textLength($message) > 2000) {
    $errors[] = 'Message must be between 10 and 2000 characters.';
}

if (!empty($errors)) {
    renderContactError(implode("\n", $errors));
}

unset($_SESSION['travelmate_form_tokens'][$tokenHash]);
require __DIR__ . '/db.php';

try {
    $stmt = $pdo->prepare(
        'INSERT INTO contact_messages (name, email, subject, message) VALUES (:name, :email, :subject, :message)'
    );

    $stmt->execute([
        ':name' => $name,
        ':email' => $email,
        ':subject' => $subject,
        ':message' => $message,
    ]);

    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Message Sent</title><link rel="stylesheet" href="../css/style.css" /></head><body class="booking-success-page"><main class="success-page"><section class="success-card" aria-live="polite"><div class="success-icon" aria-hidden="true">✓</div><h1>Message Submitted!</h1><p class="success-message">Thank you for reaching out to TravelMate. Our team will contact you soon.</p><div class="success-details"><p><strong>Subject:</strong> ' . htmlspecialchars($subject, ENT_QUOTES, 'UTF-8') . '</p><p><strong>Email:</strong> ' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '</p></div><div class="success-actions"><a class="form-button" href="../contact.html">Back to Contact</a><a class="secondary-btn" href="../index.html">Back to Home</a></div></section></main></body></html>';
} catch (PDOException $e) {
    error_log('TravelMate contact insert failed: ' . $e->getMessage());
    renderContactError('Unable to save your message at the moment. Please try again later.');
}
?>
