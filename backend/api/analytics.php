<?php
/**
 * IAAMS - Analytics API (OPTIMIZED)
 * Uses PostgreSQL RPC functions for single-call data retrieval
 */

function handleAnalytics(Database $db, string $method, array $segments) {
    $action = $segments[1] ?? '';
    if ($method === 'GET') {
        switch ($action) {
            case 'attendance-trends': getAttendanceTrends($db); break;
            case 'fraud-alerts': getFraudAlerts($db); break;
            case 'trust-distribution': getTrustDistribution($db); break;
            default: errorResponse('Unknown analytics endpoint', 404);
        }
    } elseif ($method === 'POST') {
        switch ($action) {
            case 'resolve-alert': resolveFraudAlert($db); break;
            default: errorResponse('Unknown analytics post endpoint', 404);
        }
    } else {
        errorResponse('Method not allowed', 405);
    }
}

function getAttendanceTrends(Database $db) {
    // OPTIMIZED: Single RPC call replaces N+1 queries
    $result = $db->rpc('get_attendance_trends');
    successResponse($result ?? []);
}

function getFraudAlerts(Database $db) {
    try {
        // Fetch with PostgREST join to get students/sessions details including session_id
        $records = $db->select(
            'fraud_alerts',
            'id,alert_type,severity,description,resolved,created_at,session_id,students!inner(name,matrix_number,trust_score),sessions(topic)',
            [],
            'created_at.desc'
        );
        
        $alerts = array_map(function ($a) {
            return [
                'id' => $a['id'],
                'alert_type' => $a['alert_type'],
                'severity' => $a['severity'],
                'description' => $a['description'],
                'resolved' => $a['resolved'],
                'created_at' => $a['created_at'],
                'session_id' => $a['session_id'],
                'student_name' => $a['students']['name'],
                'matrix_number' => $a['students']['matrix_number'],
                'trust_score' => (float)$a['students']['trust_score'],
                'session_topic' => $a['sessions']['topic'] ?? 'Untitled Session',
            ];
        }, $records);
        
        successResponse($alerts);
    } catch (\Exception $e) {
        errorResponse('Failed to retrieve fraud alerts: ' . $e->getMessage(), 500);
    }
}

function resolveFraudAlert(Database $db) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['alert_id'])) {
        errorResponse('Missing required field: alert_id', 400);
        return;
    }
    
    $alertId = $input['alert_id'];
    
    // 1. Get the alert to find the student_id (to recalculate their score)
    $alerts = $db->select('fraud_alerts', 'student_id,resolved', ['id' => "eq.{$alertId}"]);
    if (empty($alerts)) {
        errorResponse('Alert not found', 404);
        return;
    }
    
    $alert = $alerts[0];
    if ($alert['resolved']) {
        successResponse(null, 'Alert already resolved');
        return;
    }
    
    // 2. Update the alert to be resolved
    $db->update('fraud_alerts', [
        'resolved' => true,
        'resolved_at' => date('c'),
        'resolved_by' => 'Lecturer'
    ], ['id' => "eq.{$alertId}"]);
    
    // 3. Recalculate trust score for this student
    if (!empty($alert['student_id'])) {
        try {
            $db->rpc('calculate_trust_score', ['p_student_id' => $alert['student_id']]);
        } catch (\Exception $e) {
            // Log it but continue
            error_log("Recalculate trust score failed on resolution: " . $e->getMessage());
        }
    }
    
    successResponse(null, 'Alert resolved successfully');
}

function getTrustDistribution(Database $db) {
    // OPTIMIZED: Single RPC call with bucket aggregation in SQL
    $result = $db->rpc('get_trust_distribution');
    successResponse($result ?? []);
}

