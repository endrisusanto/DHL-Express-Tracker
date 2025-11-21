<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database configuration from environment variables
$db_host = getenv('DB_HOST') ?: 'db';
$db_name = getenv('DB_NAME') ?: 'dhl_tracker';
$db_user = getenv('DB_USER') ?: 'dhl_user';
$db_pass = getenv('DB_PASSWORD') ?: 'dhl_pass';

try {
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4",
        $db_user,
        $db_pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// GET /api/logs.php - Get all activity logs
if ($method === 'GET') {
    try {
        $stmt = $pdo->query("
            SELECT log_id, timestamp, action, description, related_shipment_id
            FROM activity_logs
            ORDER BY timestamp DESC
            LIMIT 100
        ");
        $logs = $stmt->fetchAll();
        echo json_encode($logs);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch logs: ' . $e->getMessage()]);
    }
}

// POST /api/logs.php - Create new activity log
elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['log_id']) || !isset($data['action']) || !isset($data['description'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        exit();
    }
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO activity_logs (log_id, timestamp, action, description, related_shipment_id)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                timestamp = VALUES(timestamp),
                action = VALUES(action),
                description = VALUES(description),
                related_shipment_id = VALUES(related_shipment_id)
        ");
        $stmt->execute([
            $data['log_id'],
            $data['timestamp'],
            $data['action'],
            $data['description'],
            $data['related_shipment_id'] ?? null
        ]);
        
        http_response_code(200);
        echo json_encode(['message' => 'Log saved successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save log: ' . $e->getMessage()]);
    }
}

else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
