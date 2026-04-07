<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=cod_crm', 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_TIMEOUT => 5
]);
echo "Connected OK\n";

// Kill stale connections
$rows = $pdo->query('SHOW PROCESSLIST')->fetchAll();
$killed = 0;
foreach ($rows as $r) {
    $info = $r['Id'] . ' | ' . $r['db'] . ' | ' . $r['Command'] . ' | ' . $r['Time'] . 's';
    echo $info . "\n";
    // Kill connections sleeping for >60 seconds (but not our own)
    if ($r['Time'] > 60 && $r['Id'] != $pdo->query('SELECT CONNECTION_ID()')->fetchColumn()) {
        echo "  -> Killing stale connection {$r['Id']}\n";
        try { $pdo->exec('KILL ' . (int)$r['Id']); $killed++; } catch (Exception $e) {}
    }
}
echo "Killed $killed stale connections\n\n";

// Now quick test
$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
echo "FK checks disabled\n";

$count = $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();
echo "Current orders: $count\n";

// Truncate tables
echo "Truncating tables...\n";
$pdo->exec('TRUNCATE TABLE returns');
echo "  returns OK\n";
$pdo->exec('TRUNCATE TABLE deliveries');
echo "  deliveries OK\n";
$pdo->exec('TRUNCATE TABLE order_status_history');
echo "  order_status_history OK\n";
$pdo->exec('TRUNCATE TABLE order_items');
echo "  order_items OK\n";
$pdo->exec('TRUNCATE TABLE orders');
echo "  orders OK\n";
$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
echo "FK checks re-enabled\n\n";

// Now load the seed data (only INSERT statements)
$sqlFile = __DIR__ . '/seed_data.sql';
$sql = str_replace("\r\n", "\n", file_get_contents($sqlFile));
$parts = preg_split('/;\s*\n/', $sql);

$inserts = [];
foreach ($parts as $p) {
    $p = trim($p);
    if (stripos($p, 'INSERT') === 0) {
        $inserts[] = $p;
    }
}

echo "Executing " . count($inserts) . " INSERT statements...\n";
$done = 0;
foreach ($inserts as $stmt) {
    $pdo->exec($stmt);
    $done++;
    if ($done % 5 === 0) echo "  $done/" . count($inserts) . " done\n";
}
echo "  $done/" . count($inserts) . " done\n";

// Verify
$count = $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();
echo "\nOrders in DB: $count\n";
$rows = $pdo->query('SELECT status, COUNT(*) as c FROM orders GROUP BY status ORDER BY c DESC')->fetchAll();
foreach ($rows as $r) echo "  " . str_pad($r['status'], 15) . ": " . $r['c'] . "\n";

$stmt = $pdo->query("SELECT MIN(created_at), MAX(created_at) FROM orders");
$row = $stmt->fetch();
echo "\nDate range: {$row[0]} to {$row[1]}\n";
echo "Done!\n";
