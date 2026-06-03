<?php
/**
 * IAAMS - Analytics API
 * Session-scoped fraud alerts and attendance trends.
 * No joins to the students table — identity stored inline on each row.
 */

function handleAnalytics(Database $db, string $method, array $segments) {
    $action = $segments[1] ?? '';
    if ($method === 'GET') {
        switch ($action) {
            case 'attendance-trends': getAttendanceTrends($db); break;
            case 'fraud-alerts':      getFraudAlerts($db);      break;
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
    $result = $db->rpc('get_attendance_trends');
    successResponse($result ?? []);
}

function getFraudAlerts(Database $db) {
    try {
        // Read student identity directly from fraud_alerts columns — no students JOIN
        $records = $db->select(
            'fraud_alerts',
            'id,alert_type,severity,description,resolved,created_at,session_id,student_name,matrix_number,sessions(topic)',
            [],
            'created_at.desc'
        );

        $alerts = array_map(function ($a) {
            return [
                'id'            => $a['id'],
                'alert_type'    => $a['alert_type'],
                'severity'      => $a['severity'],
                'description'   => $a['description'],
                'resolved'      => $a['resolved'],
                'created_at'    => $a['created_at'],
                'session_id'    => $a['session_id'],
                'student_name'  => $a['student_name'] ?? 'Unknown',
                'matrix_number' => $a['matrix_number'] ?? '—',
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

    // Check alert exists and is not already resolved
    $alerts = $db->select('fraud_alerts', 'id,resolved', ['id' => "eq.{$alertId}"]);
    if (empty($alerts)) {
        errorResponse('Alert not found', 404);
        return;
    }

    if ($alerts[0]['resolved']) {
        successResponse(null, 'Alert already resolved');
        return;
    }

    // Mark as resolved
    $db->update('fraud_alerts', [
        'resolved'    => true,
        'resolved_at' => date('c'),
        'resolved_by' => 'Lecturer'
    ], ['id' => "eq.{$alertId}"]);

    successResponse(null, 'Alert resolved successfully');
}
