<?php
/**
 * IAAMS - Webhook API
 * Handles Zoom webhooks with REAL duration tracking
 * 
 * Flow: Zoom → Railway PHP → Supabase PostgreSQL
 * 
 * Attendance Rule:
 *   Students who stayed >= 50% of meeting duration = PASS (attendance counted)
 *   Students who stayed < 50% = FAIL (attendance NOT counted)
 */

function handleWebhook(Database $db, string $method, array $segments) {
    // Log EVERY incoming webhook request for debugging
    $rawBody = file_get_contents('php://input');
    $db->insert('webhook_logs', [
        'method'  => $method,
        'headers' => json_encode(getallheaders()),
        'body'    => $rawBody ?: '(empty)',
    ]);
    
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
    
    // Handle Zoom URL validation (CRC challenge)
    if (isset($input['event']) && $input['event'] === 'endpoint.url_validation') {
        $plainToken = $input['payload']['plainToken'];
        $secretToken = 'aHJgzmg7Q-yjL4RAe3I3mw'; 
        $encryptedToken = hash_hmac('sha256', $plainToken, $secretToken);
        echo json_encode(['plainToken' => $plainToken, 'encryptedToken' => $encryptedToken]);
        exit();
    }

    $event = $input['event'] ?? '';
    $m = $input['payload']['object'] ?? [];
    $p = $m['participant'] ?? [];
    $meetingId = (string)($m['id'] ?? '');
    $topic = $m['topic'] ?? 'Untitled';

    switch ($event) {

        // ═══════════════════════════════════════════════════════
        // MEETING STARTED — Record actual start time
        // ═══════════════════════════════════════════════════════
        case 'meeting.started':
            $session = findOrCreateSession($db, $meetingId, $topic);
            $db->update('sessions', [
                'actual_start_time' => $m['start_time'] ?? date('c'),
                'status' => 'active',
                'duration_minutes' => 0,
            ], ['id' => "eq.{$session['id']}"]);
            successResponse(['action' => 'meeting_started', 'session_id' => $session['id']]);
            break;

        // ═══════════════════════════════════════════════════════
        // MEETING ENDED — Calculate real duration + evaluate all students
        // ═══════════════════════════════════════════════════════
        case 'meeting.ended':
            $session = findOrCreateSession($db, $meetingId, $topic);
            $endTime = $m['end_time'] ?? date('c');
            $startTime = $session['actual_start_time'] ?? $session['scheduled_time'];
            
            // Calculate actual meeting duration
            $meetingDurationSec = max(0, strtotime($endTime) - strtotime($startTime));
            $meetingDurationMin = round($meetingDurationSec / 60);
            $halfDuration = $meetingDurationSec / 2;

            // Update session with real duration
            $db->update('sessions', [
                'actual_end_time' => $endTime,
                'actual_duration_minutes' => $meetingDurationMin,
                'duration_minutes' => $meetingDurationMin,
                'status' => 'completed',
            ], ['id' => "eq.{$session['id']}"]);

            // Evaluate ALL attendance records for this session
            $records = $db->select('attendance', '*', ['session_id' => "eq.{$session['id']}"]);
            $presentCount = 0;
            $lateCount = 0;
            $absentCount = 0;

            foreach ($records as $rec) {
                $studentDuration = (int)($rec['duration_seconds'] ?? 0);
                
                // If student never left (still in meeting when it ended), calculate from join to end
                if (empty($rec['leave_time'])) {
                    $studentDuration = max(0, strtotime($endTime) - strtotime($rec['join_time']));
                    $db->update('attendance', [
                        'leave_time' => $endTime,
                        'duration_seconds' => $studentDuration,
                    ], ['id' => "eq.{$rec['id']}"]);
                }

                // Calculate what percentage of meeting the student attended
                $percentage = $meetingDurationSec > 0 ? round(($studentDuration / $meetingDurationSec) * 100, 1) : 0;
                $pass = $studentDuration >= $halfDuration; // >= 50% = PASS

                // PASS = attendance recorded, FAIL = marked absent
                $status = $pass ? ($rec['status'] === 'late' ? 'late' : 'present') : 'absent';
                $db->update('attendance', [
                    'attendance_pass' => $pass ? 'true' : 'false',
                    'attendance_percentage' => $percentage,
                    'status' => $status,
                ], ['id' => "eq.{$rec['id']}"]);

                if ($status === 'present') $presentCount++;
                elseif ($status === 'late') $lateCount++;
                else $absentCount++;

                // Create fraud alert for students who failed the 50% check
                if (!$pass && $studentDuration > 0) {
                    $db->insert('fraud_alerts', [
                        'student_id' => $rec['student_id'], 'session_id' => $session['id'],
                        'alert_type' => 'short_duration', 'severity' => 'high',
                        'description' => "Attended " . round($studentDuration/60) . "m of {$meetingDurationMin}m ({$percentage}%). Required: 50%",
                    ]);
                }
            }

            // Update session totals with final counts
            $db->update('sessions', [
                'total_present' => $presentCount,
                'total_late' => $lateCount,
                'total_absent' => $absentCount,
            ], ['id' => "eq.{$session['id']}"]);

            // Recalculate trust scores for ALL students in this session
            recalculateAllTrustScores($db, $session['id']);

            successResponse([
                'action' => 'meeting_ended',
                'duration_minutes' => $meetingDurationMin,
                'evaluated' => count($records),
                'passed' => $presentCount + $lateCount,
                'failed' => $absentCount,
            ]);
            break;

        // ═══════════════════════════════════════════════════════
        // PARTICIPANT JOINED — Record join time
        // ═══════════════════════════════════════════════════════
        case 'meeting.participant_joined':
            $displayName = $p['user_name'] ?? '';
            $validator = new NameValidator();
            $v = $validator->validate($displayName);
            $session = findOrCreateSession($db, $meetingId, $topic);
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
                recalculateTrustScore($db, $student['id']);
                successResponse(['action' => 'recorded', 'student' => $student['name']]);
            } else {
                $db->insert('fraud_alerts', [
                    'session_id' => $session['id'], 'alert_type' => 'invalid_format',
                    'severity' => 'low', 'description' => "Invalid name: '{$displayName}'. {$v['error']}",
                ]);
                successResponse(['action' => 'flagged', 'error' => $v['error']]);
            }
            break;

        // ═══════════════════════════════════════════════════════
        // PARTICIPANT LEFT — Record leave time + duration so far
        // (Final pass/fail is decided when meeting ENDS)
        // ═══════════════════════════════════════════════════════
        case 'meeting.participant_left':
            $displayName = $p['user_name'] ?? '';
            $validator = new NameValidator();
            $v = $validator->validate($displayName);
            if ($v['valid']) {
                $session = findOrCreateSession($db, $meetingId, $topic);
                $stu = $db->select('students', 'id', ['matrix_number' => "eq.{$v['matrix_number']}"]);
                if (!empty($stu)) {
                    $att = $db->select('attendance', '*', [
                        'student_id' => "eq.{$stu[0]['id']}", 'session_id' => "eq.{$session['id']}"
                    ]);
                    if (!empty($att)) {
                        $leaveTime = $p['leave_time'] ?? date('c');
                        $dur = max(0, strtotime($leaveTime) - strtotime($att[0]['join_time']));
                        $db->update('attendance', [
                            'leave_time' => $leaveTime,
                            'duration_seconds' => $dur,
                        ], ['id' => "eq.{$att[0]['id']}"]);
                        updateSessionTotals($db, $session['id']);
                        successResponse(['action' => 'leave_recorded', 'duration_seconds' => $dur]);
                    }
                }
            }
            successResponse(['action' => 'ignored_leave']);
            break;

        default:
            successResponse(['action' => 'ignored', 'event' => $event]);
    }
}

function handleN8nWebhook(Database $db, string $rawBody) {
    $input = json_decode($rawBody, true);
    if (!$input) { errorResponse('Invalid JSON from n8n', 400); return; }
    successResponse(['action' => 'processed', 'note' => 'n8n no longer needed - Zoom sends directly']);
}

function findOrCreateSession(Database $db, string $meetingId, string $topic): array {
    // First try to find existing session
    $e = $db->select('sessions', '*', ['meeting_id' => "eq.{$meetingId}"]);
    if (!empty($e)) return $e[0];
    
    // Use upsert to handle race condition (meeting.started + participant_joined arrive simultaneously)
    try {
        $r = $db->insert('sessions', ['meeting_id' => $meetingId, 'topic' => $topic,
            'course_code' => 'CSC401', 'scheduled_time' => date('c'), 'duration_minutes' => 0, 'status' => 'active']);
        return $r[0] ?? $r;
    } catch (\Exception $e) {
        // If insert failed due to unique constraint, session was just created by another request
        $existing = $db->select('sessions', '*', ['meeting_id' => "eq.{$meetingId}"]);
        if (!empty($existing)) return $existing[0];
        throw $e;
    }
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

/**
 * Recalculate trust score for a single student
 */
function recalculateTrustScore(Database $db, string $studentId): void {
    try {
        $db->rpc('calculate_trust_score', ['p_student_id' => $studentId]);
    } catch (\Exception $e) {
        error_log("Trust score calc failed for {$studentId}: " . $e->getMessage());
    }
}

/**
 * Recalculate trust scores for ALL students in a session
 */
function recalculateAllTrustScores(Database $db, string $sessionId): void {
    $records = $db->select('attendance', 'student_id', ['session_id' => "eq.{$sessionId}"]);
    foreach ($records as $rec) {
        recalculateTrustScore($db, $rec['student_id']);
    }
}

