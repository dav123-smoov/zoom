<?php
/**
 * IAAMS - Webhook API
 * Handles Zoom webhooks and n8n processed data
 * 
 * Flow: Zoom → n8n → PHP /api/webhook/n8n → Supabase PostgreSQL
 */

function handleWebhook(Database $db, string $method, array $segments) {
    // Log EVERY incoming webhook request for debugging
    $rawBody = file_get_contents('php://input');
    $db->insert('webhook_logs', [
        'method'  => $method,
        'headers' => json_encode(getallheaders()),
        'body'    => $rawBody ?: '(empty)',
    ]);
    
    // Accept POST for actual webhooks, but don't block other methods (Zoom may send GET for validation)
    $source = $segments[1] ?? '';
    switch ($source) {
        case 'zoom': handleZoomWebhook($db, $rawBody); break;
        case 'n8n':  handleN8nWebhook($db, $rawBody); break;
        case 'logs': getWebhookLogs($db); break;
        default: errorResponse('Use /api/webhook/zoom or /api/webhook/n8n', 400);
    }
}

function getWebhookLogs(Database $db) {
    $logs = $db->select('webhook_logs', '*', [], 'received_at.desc', 20);
    successResponse($logs);
}

function handleZoomWebhook(Database $db, string $rawBody) {
    $input = json_decode($rawBody, true);
    if (!$input) { errorResponse('Invalid JSON', 400); return; }
    if (isset($input['event']) && $input['event'] === 'endpoint.url_validation') {
        $plainToken = $input['payload']['plainToken'];
        // Zoom requires HMAC SHA-256 encryption of the plainToken using your Secret Token
        $secretToken = 'aHJgzmg7Q-yjL4RAe3I3mw'; 
        $encryptedToken = hash_hmac('sha256', $plainToken, $secretToken);
        
        echo json_encode([
            'plainToken' => $plainToken,
            'encryptedToken' => $encryptedToken
        ]);
        exit();
    }
    $event = $input['event'] ?? '';
    $p = $input['payload']['object']['participant'] ?? [];
    $m = $input['payload']['object'] ?? [];
    $displayName = $p['user_name'] ?? '';
    
    if ($event === 'meeting.participant_joined') {
        $validator = new NameValidator();
        $v = $validator->validate($displayName);
        $session = findOrCreateSession($db, (string)($m['id'] ?? ''), $m['topic'] ?? 'Untitled');
        if ($v['valid']) {
            $student = findOrCreateStudent($db, $v['name'], $v['matrix_number']);
            $db->upsert('attendance', [
                'student_id' => $student['id'], 'session_id' => $session['id'],
                'join_time' => $p['join_time'] ?? date('c'), 'status' => 'present',
                'raw_display_name' => $displayName, 'is_suspicious' => false,
            ]);
            $fd = new FraudDetector($db);
            $fd->analyze($student['id'], $session['id'], []);
            updateSessionTotals($db, $session['id']);
            successResponse(['action' => 'recorded', 'student' => $student['name']]);
        } else {
            $db->insert('fraud_alerts', [
                'session_id' => $session['id'], 'alert_type' => 'invalid_format',
                'severity' => 'low', 'description' => "Invalid: '{$displayName}'. {$v['error']}",
            ]);
            successResponse(['action' => 'flagged', 'error' => $v['error']]);
        }
    } elseif ($event === 'meeting.participant_left') {
        $validator = new NameValidator();
        $v = $validator->validate($displayName);
        if ($v['valid']) {
            $session = findOrCreateSession($db, (string)($m['id'] ?? ''), $m['topic'] ?? 'Untitled');
            $stu = $db->select('students', 'id', ['matrix_number' => "eq.{$v['matrix_number']}"]);
            $att = $db->select('attendance', '*', ['student_id' => "eq.{$stu[0]['id']}", 'session_id' => "eq.{$session['id']}"]);
            
            if (!empty($stu) && !empty($att)) {
                $joinTime = $att[0]['join_time'];
                $leaveTime = $p['leave_time'] ?? date('c');
                $dur = max(0, strtotime($leaveTime) - strtotime($joinTime));
                
                $db->update('attendance', ['leave_time' => $leaveTime, 'duration_seconds' => $dur],
                    ['student_id' => "eq.{$stu[0]['id']}", 'session_id' => "eq.{$session['id']}"]);
                    
                if ($dur < 600) { // Less than 10 minutes
                    $db->insert('fraud_alerts', [
                        'student_id' => $stu[0]['id'], 'session_id' => $session['id'],
                        'alert_type' => 'short_duration', 'severity' => 'high',
                        'description' => "Left after " . round($dur/60,1) . " min (< 10 min threshold)",
                    ]);
                }
                updateSessionTotals($db, $session['id']);
                successResponse(['action' => 'leave_recorded', 'duration' => $dur]);
            }
        }
        successResponse(['action' => 'ignored_leave', 'reason' => 'student or session not found']);
    } else { 
        successResponse(['action' => 'ignored', 'event' => $event]); 
    }
}

function handleN8nWebhook(Database $db, string $rawBody) {
    $input = json_decode($rawBody, true);
    if (!$input) { errorResponse('Invalid JSON from n8n', 400); return; }
    $name = $input['name'] ?? '';
    $matrix = $input['matrix_number'] ?? '';
    $meetingId = $input['meeting_id'] ?? '';
    $topic = $input['topic'] ?? 'Untitled';
    $joinTime = $input['join_time'] ?? date('c');
    $valid = $input['is_valid_format'] ?? false;
    $eventType = $input['event_type'] ?? 'participant_joined';
    $display = $input['display_name'] ?? "{$name}_{$matrix}";

    $session = findOrCreateSession($db, $meetingId, $topic);

    if ($eventType === 'participant_joined' && $valid && $matrix) {
        $student = findOrCreateStudent($db, $name, $matrix);
        $att = $db->upsert('attendance', [
            'student_id' => $student['id'], 'session_id' => $session['id'],
            'join_time' => $joinTime, 'status' => 'present',
            'raw_display_name' => $display, 'is_suspicious' => false,
        ]);
        $fd = new FraudDetector($db);
        $alerts = $fd->analyze($student['id'], $session['id'], $att[0] ?? []);
        updateSessionTotals($db, $session['id']);
        successResponse(['action' => 'recorded', 'student' => $name, 'alerts' => count($alerts)]);
    } elseif ($eventType === 'participant_left' && $matrix) {
        $stu = $db->select('students', 'id', ['matrix_number' => "eq.{$matrix}"]);
        if (!empty($stu)) {
            $dur = max(0, strtotime($input['leave_time'] ?? date('c')) - strtotime($joinTime));
            $db->update('attendance', ['leave_time' => $input['leave_time'] ?? date('c'), 'duration_seconds' => $dur],
                ['student_id' => "eq.{$stu[0]['id']}", 'session_id' => "eq.{$session['id']}"]);
            if ($dur < 600) {
                $db->insert('fraud_alerts', [
                    'student_id' => $stu[0]['id'], 'session_id' => $session['id'],
                    'alert_type' => 'short_duration', 'severity' => 'high',
                    'description' => "Left after " . round($dur/60,1) . " min (< 10 min threshold)",
                ]);
            }
            updateSessionTotals($db, $session['id']);
        }
        successResponse(['action' => 'leave_recorded']);
    } else {
        if (!$valid) {
            $db->insert('fraud_alerts', ['session_id' => $session['id'], 'alert_type' => 'invalid_format',
                'severity' => 'low', 'description' => "n8n flagged: '{$display}'"]);
        }
        successResponse(['action' => 'processed']);
    }
}

function findOrCreateSession(Database $db, string $meetingId, string $topic): array {
    $e = $db->select('sessions', '*', ['meeting_id' => "eq.{$meetingId}"]);
    if (!empty($e)) return $e[0];
    $r = $db->insert('sessions', ['meeting_id' => $meetingId, 'topic' => $topic,
        'course_code' => 'CSC401', 'scheduled_time' => date('c'), 'duration_minutes' => 60, 'status' => 'active']);
    return $r[0] ?? $r;
}

function findOrCreateStudent(Database $db, string $name, string $matrix): array {
    $e = $db->select('students', '*', ['matrix_number' => "eq.{$matrix}"]);
    if (!empty($e)) return $e[0];
    $r = $db->insert('students', ['name' => $name, 'matrix_number' => $matrix]);
    return $r[0] ?? $r;
}

function updateSessionTotals(Database $db, string $sessionId): void {
    $recs = $db->select('attendance', 'status', ['session_id' => "eq.{$sessionId}"]);
    $db->update('sessions', [
        'total_present' => count(array_filter($recs, fn($r) => $r['status'] === 'present')),
        'total_late' => count(array_filter($recs, fn($r) => $r['status'] === 'late')),
        'total_absent' => count(array_filter($recs, fn($r) => in_array($r['status'], ['absent','suspicious']))),
    ], ['id' => "eq.{$sessionId}"]);
}
