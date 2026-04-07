<?php
// Hash password and update database
$password = 'test123';
$hashed = password_hash($password, PASSWORD_BCRYPT);

require 'vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Connect to database
$conn = new mysqli($_ENV['DB_HOST'], $_ENV['DB_USERNAME'], $_ENV['DB_PASSWORD'], $_ENV['DB_DATABASE']);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$conn->set_charset("utf8mb4");

// Update both test users with hashed password
$sql = "UPDATE users SET password = ? WHERE email IN ('ahmed@electroshop.dz', 'fatima@electroshop.dz')";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $hashed);
$stmt->execute();

echo "Updated " . $stmt->affected_rows . " users with hashed password.\n";
echo "Password hash: " . $hashed . "\n";

$stmt->close();
$conn->close();
?>
