<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
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
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// GET /api/shipments.php - Get all shipments or specific shipment by tracking number
if ($method === 'GET') {
    if (isset($_GET['tracking_number'])) {
        $tracking_number = $_GET['tracking_number'];
        
        $stmt = $pdo->prepare("
            SELECT s.*, 
                   (SELECT JSON_ARRAYAGG(
                       JSON_OBJECT(
                           'id', te.id,
                           'event_date', te.event_date,
                           'location', te.location,
                           'status', te.status,
                           'description', te.description
                       )
                   )
                   FROM tracking_events te
                   WHERE te.shipment_id = s.id
                   ORDER BY te.event_date DESC
                   ) as events
            FROM shipments s
            WHERE s.tracking_number = ?
        ");
        $stmt->execute([$tracking_number]);
        $shipment = $stmt->fetch();
        
        if ($shipment) {
            $shipment['events'] = json_decode($shipment['events'] ?? '[]');
            echo json_encode($shipment);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Shipment not found']);
        }
    } else {
        $stmt = $pdo->query("SELECT * FROM shipments ORDER BY created_at DESC LIMIT 100");
        $shipments = $stmt->fetchAll();
        echo json_encode($shipments);
    }
}

// POST /api/shipments.php - Create or update shipment
elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['tracking_number']) || !isset($data['status'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        exit();
    }
    
    try {
        // Use INSERT ... ON DUPLICATE KEY UPDATE to handle both create and update
        $stmt = $pdo->prepare("
            INSERT INTO shipments (tracking_number, status, origin, destination, estimated_delivery, shipment_data)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                origin = VALUES(origin),
                destination = VALUES(destination),
                estimated_delivery = VALUES(estimated_delivery),
                shipment_data = VALUES(shipment_data)
        ");
        
        $shipment_data_json = isset($data['shipment_data']) ? $data['shipment_data'] : null;
        
        $stmt->execute([
            $data['tracking_number'],
            $data['status'],
            $data['origin'] ?? null,
            $data['destination'] ?? null,
            $data['estimated_delivery'] ?? null,
            $shipment_data_json
        ]);
        
        $shipment_id = $pdo->lastInsertId() ?: $pdo->query("SELECT id FROM shipments WHERE tracking_number = " . $pdo->quote($data['tracking_number']))->fetchColumn();
        
        http_response_code(200);
        echo json_encode(['id' => $shipment_id, 'message' => 'Shipment saved successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save shipment: ' . $e->getMessage()]);
    }
}

// PUT /api/shipments.php - Update shipment
elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['tracking_number'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing tracking number']);
        exit();
    }
    
    try {
        $updates = [];
        $params = [];
        
        if (isset($data['status'])) {
            $updates[] = 'status = ?';
            $params[] = $data['status'];
        }
        if (isset($data['origin'])) {
            $updates[] = 'origin = ?';
            $params[] = $data['origin'];
        }
        if (isset($data['destination'])) {
            $updates[] = 'destination = ?';
            $params[] = $data['destination'];
        }
        if (isset($data['estimated_delivery'])) {
            $updates[] = 'estimated_delivery = ?';
            $params[] = $data['estimated_delivery'];
        }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['error' => 'No fields to update']);
            exit();
        }
        
        $params[] = $data['tracking_number'];
        $sql = "UPDATE shipments SET " . implode(', ', $updates) . " WHERE tracking_number = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        echo json_encode(['message' => 'Shipment updated successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update shipment: ' . $e->getMessage()]);
    }
}

// DELETE /api/shipments.php - Delete shipment
elseif ($method === 'DELETE') {
    if (!isset($_GET['tracking_number'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing tracking number']);
        exit();
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM shipments WHERE tracking_number = ?");
        $stmt->execute([$_GET['tracking_number']]);
        
        echo json_encode(['message' => 'Shipment deleted successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete shipment: ' . $e->getMessage()]);
    }
}

else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
