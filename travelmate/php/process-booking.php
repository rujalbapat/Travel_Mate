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

function renderBookingError(string $message): void
{
    $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Booking Error</title><link rel="stylesheet" href="../css/style.css" /></head><body class="booking-success-page"><main class="success-page"><section class="success-card" aria-live="polite"><div class="success-icon" aria-hidden="true">!</div><h1>Booking could not be submitted</h1><p class="success-message">Please review the form details and try again.</p><div class="success-details"><p>' . $safeMessage . '</p></div><div class="success-actions"><a class="form-button" href="../booking.html">Back to Booking</a><a class="secondary-btn" href="../index.html">Back to Home</a></div></section></main></body></html>';
    exit;
}

function parseTravelDate(string $travelDate): ?DateTimeImmutable
{
    $date = DateTimeImmutable::createFromFormat('Y-m-d', $travelDate);
    if (!$date) {
        return null;
    }

    return $date->format('Y-m-d') === $travelDate ? $date : null;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    renderBookingError('Invalid request method.');
}

$submittedToken = is_string($_POST['csrf_token'] ?? null) ? $_POST['csrf_token'] : '';
$tokenHash = hash('sha256', $submittedToken);
$tokenIssuedAt = $_SESSION['travelmate_form_tokens'][$tokenHash] ?? null;
if ($submittedToken === '' || !is_int($tokenIssuedAt) || $tokenIssuedAt < time() - 7200) {
    renderBookingError('The form expired or could not be verified. Reload the booking page and try again.');
}
if (postText('website') !== '') {
    renderBookingError('Booking could not be submitted. Please try again.');
}

$fullName = postText('full_name');
$email = postText('email');
$phone = postText('phone');
$destination = postText('destination');
$travelDate = postText('travel_date');
$adultsValue = filter_var(postText('adults'), FILTER_VALIDATE_INT);
$childrenValue = filter_var(postText('children'), FILTER_VALIDATE_INT);
$nightsValue = filter_var(postText('nights'), FILTER_VALIDATE_INT);
$adults = $adultsValue !== false && $adultsValue !== null ? $adultsValue : 0;
$children = $childrenValue !== false && $childrenValue !== null ? $childrenValue : -1;
$nightCount = $nightsValue !== false && $nightsValue !== null ? $nightsValue : 0;
$travellers = $adults + $children;
$packageDuration = postText('package_duration');
$packagePriceInput = postText('package_price');
$packagePrice = is_numeric($packagePriceInput) ? (float)$packagePriceInput : -1;
$packageCategory = postText('package_category');
$travelMode = postText('travel_mode');
$specialRequests = postText('special_requests');

$errors = [];

if ($fullName === '' || textLength($fullName) > 150) {
    $errors[] = 'Full name is required and must be 150 characters or fewer.';
}
if ($email === '' || textLength($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Please enter a valid email address.';
}
$normalizedPhoneDigits = preg_replace('/\D+/', '', $phone);
if ($phone === '' || textLength($phone) > 30 || !preg_match('/^[0-9+()\-\s]{8,20}$/', $phone) || strlen($normalizedPhoneDigits) < 8) {
    $errors[] = 'Please enter a valid phone number.';
}
if ($destination === '') {
    $errors[] = 'Destination is required.';
}
$travelDateObject = $travelDate !== '' ? parseTravelDate($travelDate) : null;
if ($travelDateObject === null) {
    $errors[] = 'Please enter a valid travel date in YYYY-MM-DD format.';
} elseif ($travelDateObject < new DateTimeImmutable('today')) {
    $errors[] = 'Please choose a travel date that is today or later.';
}
if ($adults < 1 || $adults > 20) {
    $errors[] = 'Adults must be between 1 and 20.';
}
if ($children < 0 || $children > 20) {
    $errors[] = 'Children must be between 0 and 20.';
}
if ($travellers < 1 || $travellers > 20) {
    $errors[] = 'Total travellers must be between 1 and 20.';
}
if ($nightCount < 1 || $nightCount > 30) {
    $errors[] = 'Number of nights must be between 1 and 30.';
}
if ($specialRequests !== '' && textLength($specialRequests) > 1000) {
    $errors[] = 'Special requests must be 1000 characters or fewer.';
}

if (!empty($errors)) {
    renderBookingError(implode("\n", $errors));
}

$packageDataPath = __DIR__ . '/../data/travel-packages.json';
$packageJson = is_readable($packageDataPath) ? file_get_contents($packageDataPath) : false;
$packageData = $packageJson !== false ? json_decode($packageJson, true) : null;
$packages = [];
$packageDataIsValid = is_array($packageData) && $packageData !== []
    && array_keys($packageData) === range(0, count($packageData) - 1);
if ($packageDataIsValid) {
    foreach ($packageData as $packageItem) {
        $requiredRates = ['hotelRate', 'activityRate', 'transportRate', 'foodRate', 'otherCost'];
        $hasRates = is_array($packageItem);
        foreach ($requiredRates as $rateName) {
            $hasRates = $hasRates && isset($packageItem[$rateName])
                && (is_int($packageItem[$rateName]) || is_float($packageItem[$rateName]))
                && is_finite((float)$packageItem[$rateName])
                && (float)$packageItem[$rateName] >= 0;
        }
        $durationNights = 0;
        if (is_array($packageItem) && isset($packageItem['duration']) && is_string($packageItem['duration'])
            && preg_match('/(\d+)\s*nights?/i', $packageItem['duration'], $durationMatch)) {
            $durationNights = (int)$durationMatch[1];
        }
        if (!is_array($packageItem)
            || !isset($packageItem['name'], $packageItem['country'], $packageItem['duration'], $packageItem['nights'], $packageItem['price'])
            || !is_string($packageItem['name']) || trim($packageItem['name']) === ''
            || !is_string($packageItem['country']) || trim($packageItem['country']) === ''
            || !is_string($packageItem['duration']) || !is_int($packageItem['nights'])
            || $packageItem['nights'] < 1 || $packageItem['nights'] !== $durationNights
            || (!is_int($packageItem['price']) && !is_float($packageItem['price']))
            || !is_finite((float)$packageItem['price'])
            || (float)$packageItem['price'] <= 0 || !$hasRates) {
            $packageDataIsValid = false;
            break;
        }

        $packageKey = mb_strtolower(trim($packageItem['name']), 'UTF-8');
        if (isset($packages[$packageKey])) {
            $packageDataIsValid = false;
            break;
        }
        $packageItem['category'] = $packageItem['country'] === 'India' ? 'Domestic' : 'International';
        $packages[$packageKey] = $packageItem;
    }
}

if (!$packageDataIsValid || !$packages) {
    error_log('TravelMate package data could not be loaded.');
    renderBookingError('Booking is temporarily unavailable. Please try again later.');
}

if (!isset($packages[mb_strtolower($destination, 'UTF-8')])) {
    renderBookingError('Selected package is not available.');
}

$selectedPackage = $packages[mb_strtolower($destination, 'UTF-8')];
$destination = $selectedPackage['name'];

if ($packageDuration !== $selectedPackage['duration'] || $packageCategory !== $selectedPackage['category'] || abs($packagePrice - $selectedPackage['price']) > 0.01 || $nightCount !== $selectedPackage['nights']) {
    renderBookingError('The selected package details are out of sync. Please reload the booking page and try again.');
}

$departureCity = postText('departure_city');
$departureLocation = postText('departure_location');
if ($departureCity === '' || textLength($departureCity) > 120) {
    renderBookingError('Please enter your departure city or town.');
}

if ($selectedPackage['category'] === 'Domestic') {
    if (!in_array($travelMode, ['Train', 'Flight'], true)) {
        renderBookingError('Please select Train or Flight for this domestic package.');
    }
    if ($departureLocation === '' || textLength($departureLocation) > 180) {
        renderBookingError('Please enter your departure airport or railway station.');
    }
} else {
    $travelMode = '';
    $departureLocation = '';
}

$estimatedTotal = round($selectedPackage['price'] * $travellers, 2);
unset($_SESSION['travelmate_form_tokens'][$tokenHash]);
require __DIR__ . '/db.php';

try {
    $insert = $pdo->prepare(
        'INSERT INTO bookings (full_name, email, phone, destination, destination_country, package_category, package_duration, package_price, travel_mode, departure_city, departure_location, travel_date, adults, children, nights, travellers, special_requests, estimated_total)
         VALUES (:full_name, :email, :phone, :destination, :destination_country, :package_category, :package_duration, :package_price, :travel_mode, :departure_city, :departure_location, :travel_date, :adults, :children, :nights, :travellers, :special_requests, :estimated_total)'
    );

    $insert->execute([
        ':full_name' => $fullName,
        ':email' => $email,
        ':phone' => $phone,
        ':destination' => $destination,
        ':destination_country' => $selectedPackage['country'],
        ':package_category' => $selectedPackage['category'],
        ':package_duration' => $selectedPackage['duration'],
        ':package_price' => $selectedPackage['price'],
        ':travel_mode' => $travelMode !== '' ? $travelMode : null,
        ':departure_city' => $departureCity !== '' ? $departureCity : null,
        ':departure_location' => $departureLocation !== '' ? $departureLocation : null,
        ':travel_date' => $travelDateObject ? $travelDateObject->format('Y-m-d') : $travelDate,
        ':adults' => $adults,
        ':children' => $children,
        ':nights' => $nightCount,
        ':travellers' => $travellers,
        ':special_requests' => $specialRequests,
        ':estimated_total' => $estimatedTotal,
    ]);

    $formattedTotal = number_format($estimatedTotal, 0, '.', ',');
    $formattedPackagePrice = number_format((float)$selectedPackage['price'], 0, '.', ',');
    $safeDestination = htmlspecialchars($destination, ENT_QUOTES, 'UTF-8');
    $safeTravelMode = htmlspecialchars($travelMode !== '' ? $travelMode : 'Not applicable', ENT_QUOTES, 'UTF-8');
    $safeDeparture = htmlspecialchars($departureLocation !== '' ? $departureLocation . ', ' . $departureCity : $departureCity, ENT_QUOTES, 'UTF-8');

    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Booking Submitted</title><link rel="stylesheet" href="../css/style.css" /></head><body class="booking-success-page"><main class="success-page"><section class="success-card" aria-live="polite"><div class="success-icon" aria-hidden="true">✓</div><h1>Booking Request Submitted!</h1><p class="success-message">Thank you for choosing TravelMate! Your booking request has been received.</p><div class="success-summary"><div class="summary-item"><span>Selected package</span><strong>' . $safeDestination . '</strong></div><div class="summary-item"><span>Estimated total</span><strong>₹' . $formattedTotal . '</strong></div></div><div class="success-details"><p><strong>Package price per person:</strong> ₹' . $formattedPackagePrice . '</p><p><strong>Travel mode:</strong> ' . $safeTravelMode . '</p><p><strong>Departure:</strong> ' . $safeDeparture . '</p></div><p class="success-note">This is an estimate. Travel to the destination, visas, and insurance are excluded unless package details say otherwise. This request does not book tickets.</p><div class="success-actions"><a class="form-button" href="../index.html">Back to Home</a><a class="secondary-btn" href="../booking.html">Book Another Trip</a></div></section></main></body></html>';
} catch (PDOException $e) {
    error_log('TravelMate booking insert failed: ' . $e->getMessage());
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Booking Error</title><link rel="stylesheet" href="../css/style.css" /></head><body><div class="container" style="padding:50px 0;"><div class="message-box error">Unable to save booking request. Please try again later.</div><p><a href="../booking.html">Go back to booking page</a></p></div></body></html>';
}
?>
