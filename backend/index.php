<?php
/**
 * IAAMS - Intelligent Automated Attendance Management System
 * PHP Backend API Router
 * 
 * Architecture: React Frontend → PHP API → Supabase PostgreSQL
 * 
 * Author: Bolaji David Abiodun (220591122)
 */

// Enable error reporting for development
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Load configuration
require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/response.php';
require_once __DIR__ . '/utils/validator.php';

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Initialize database connection
try {
    $db = new Database();
} catch (Exception $e) {
    errorResponse('Database connection failed: ' . $e->getMessage(), 500);
    exit();
}

// Parse request URI
$requestUri = $_SERVER['REQUEST_URI'];
$basePath   = '/api';
$path       = parse_url($requestUri, PHP_URL_PATH);

// Remove base path prefix
if (strpos($path, $basePath) === 0) {
    $path = substr($path, strlen($basePath));
}

// Split path into segments
$segments = array_values(array_filter(explode('/', trim($path, '/'))));
$resource = $segments[0] ?? '';
$method   = $_SERVER['REQUEST_METHOD'];

// Route to appropriate handler
try {
    switch ($resource) {
        case 'dashboard':
            require_once __DIR__ . '/api/dashboard.php';
            handleDashboard($db, $method, $segments);
            break;

        case 'sessions':
            require_once __DIR__ . '/api/sessions.php';
            handleSessions($db, $method, $segments);
            break;

        case 'students':
            require_once __DIR__ . '/api/students.php';
            handleStudents($db, $method, $segments);
            break;

        case 'attendance':
            require_once __DIR__ . '/api/attendance.php';
            handleAttendance($db, $method, $segments);
            break;

        case 'analytics':
            require_once __DIR__ . '/api/analytics.php';
            handleAnalytics($db, $method, $segments);
            break;

        case 'export':
            require_once __DIR__ . '/api/export.php';
            handleExport($db, $method, $segments);
            break;

        case 'webhook':
            require_once __DIR__ . '/api/webhook.php';
            handleWebhook($db, $method, $segments);
            break;

        case 'health':
            // Health check endpoint
            successResponse([
                'status'  => 'healthy',
                'service' => 'IAAMS PHP Backend',
                'db'      => 'Supabase PostgreSQL',
                'time'    => date('c'),
            ]);
            break;

        default:
            errorResponse('Endpoint not found: /api/' . $resource, 404);
    }
} catch (Exception $e) {
    errorResponse('Server error: ' . $e->getMessage(), 500);
}
