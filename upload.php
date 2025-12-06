<?php
// --- CORS HEADERS (dynamic allowed origins) ---
$allowedOrigins = [
    'https://moviereporter.in',
    'https://www.moviereporter.in',
    'https://shanmukhcr7.github.io', // admin on GitHub Pages
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Vary: Origin");
}

header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// --- Handle Preflight Request ---
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204); // No Content
    exit;
}

// --- Secret Token (change this!)
$validToken = "abc123"; // Set a secure token

if (!isset($_GET['token']) || $_GET['token'] !== $validToken) {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Unauthorized access."]);
    exit;
}

// --- Ensure Upload Directory Exists ---
$targetDir = "uploads/";
if (!file_exists($targetDir)) {
    mkdir($targetDir, 0755, true);
}

// --- Determine Action ---
$action = $_POST['action'] ?? 'upload';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // ========== DELETE IMAGE ==========
    if ($action === 'delete') {
        $input = $_POST['url'] ?? '';
        if (!$input) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "No URL provided for deletion."]);
            exit;
        }

        $parsedUrl = parse_url($input);
        $localPath = $_SERVER['DOCUMENT_ROOT'] . $parsedUrl['path'];

        // Secure check: file must exist and be inside uploads folder
        if (is_file($localPath) && strpos(realpath($localPath), realpath($_SERVER['DOCUMENT_ROOT'] . '/uploads/')) === 0) {
            unlink($localPath);
            echo json_encode(["success" => true, "message" => "File deleted."]);
        } else {
            http_response_code(404);
            echo json_encode(["success" => false, "message" => "File not found or deletion not allowed."]);
        }
        exit;
    }

    // ========== UPLOAD IMAGE ==========
    if ($action === 'upload' && isset($_FILES['file'])) {
        $originalFileName = basename($_FILES["file"]["name"]);
        $safeFileName = time() . "_" . preg_replace("/[^a-zA-Z0-9\._-]/", "", $originalFileName);
        $targetFile = $targetDir . $safeFileName;
        $fileType = strtolower(pathinfo($targetFile, PATHINFO_EXTENSION));

        $allowedExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
        if (!in_array($fileType, $allowedExtensions)) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Invalid file type."]);
            exit;
        }

        if (move_uploaded_file($_FILES["file"]["tmp_name"], $targetFile)) {
            echo json_encode([
                "success" => true,
                "url" => dirname("https://" . $_SERVER['HTTP_HOST'] . $_SERVER['PHP_SELF']) . "/" . $targetFile
            ]);
        } else {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Upload failed."]);
        }
        exit;
    }

    // ========== INVALID REQUEST ==========
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid action or missing file."]);
} else {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed."]);
}
?>
