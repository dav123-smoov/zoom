<?php
/**
 * IAAMS - Sessions API
 * Manages Zoom meeting sessions and their attendance
 *
 * SQL Operations:
 *   SELECT * FROM sessions ORDER BY scheduled_time DESC
 *   SELECT * FROM attendance WHERE session_id = ? JOIN students
 *   INSERT INTO sessions (topic, course_code, ...) VALUES (...)
 */

function handleSessions(Database $db, string $method, array $segments) {
    $id     = $segments[1] ?? null;
    $action = $segments[2] ?? null;

    switch ($method) {
        case 'GET':
            if ($id && $action === 'attendance') {
                getSessionAttendance($db, $id);
            } elseif ($id) {
                getSession($db, $id);
            } else {
                listSessions($db);
            }
            break;
        case 'POST':
            createSession($db);
            break;
        default:
            errorResponse('Method not allowed', 405);
    }
}

function listSessions(Database $db) {
    $page  = (int)($_GET['page'] ?? 1);
    $limit = (int)($_GET['limit'] ?? 20);
    $offset = ($page - 1) * $limit;

    // SQL: SELECT * FROM sessions ORDER BY scheduled_time DESC LIMIT $limit OFFSET $offset
    $sessions = $db->select(
        'sessions',
        '*',
        [],
        'scheduled_time.desc',
        $limit,
        $offset
    );

    // SQL: SELECT COUNT(*) FROM sessions
    $allSessions = $db->select('sessions', 'id');

    successResponse([
        'data'       => $sessions,
        'pagination' => [
            'total'       => count($allSessions),
            'page'        => $page,
            'limit'       => $limit,
            'total_pages' => ceil(count($allSessions) / $limit),
        ]
    ]);
}

function getSession(Database $db, string $id) {
    // SQL: SELECT * FROM sessions WHERE id = $id
    $result = $db->select('sessions', '*', ['id' => "eq.{$id}"]);
    if (empty($result)) {
        errorResponse('Session not found', 404);
        return;
    }
    successResponse($result[0]);
}

function getSessionAttendance(Database $db, string $sessionId) {
    // SQL: SELECT a.*, s.name, s.matrix_number, s.trust_score
    //      FROM attendance a
    //      JOIN students s ON a.student_id = s.id
    //      WHERE a.session_id = $sessionId
    //      ORDER BY a.join_time ASC
    $records = $db->select(
        'attendance',
        'id,join_time,leave_time,duration_seconds,status,is_suspicious,raw_display_name,join_count,students!inner(name,matrix_number,trust_score)',
        ['session_id' => "eq.{$sessionId}"],
        'join_time.asc'
    );

    $attendance = array_map(function ($a) {
        return [
            'id'               => $a['id'],
            'student_name'     => $a['students']['name'],
            'matrix_number'    => $a['students']['matrix_number'],
            'trust_score'      => (float)$a['students']['trust_score'],
            'join_time'        => $a['join_time'],
            'leave_time'       => $a['leave_time'],
            'duration_seconds' => $a['duration_seconds'],
            'status'           => $a['status'],
            'is_suspicious'    => $a['is_suspicious'],
            'raw_display_name' => $a['raw_display_name'],
            'join_count'       => $a['join_count'],
        ];
    }, $records);

    successResponse($attendance);
}

function createSession(Database $db) {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || !isset($input['topic'], $input['meeting_id'])) {
        errorResponse('Missing required fields: topic, meeting_id', 400);
        return;
    }

    // SQL: INSERT INTO sessions (topic, course_code, meeting_id, ...)
    //      VALUES ($topic, $course_code, $meeting_id, ...)
    //      RETURNING *
    $result = $db->insert('sessions', [
        'topic'                  => $input['topic'],
        'course_code'            => $input['course_code'] ?? 'CSC401',
        'meeting_id'             => $input['meeting_id'],
        'scheduled_time'         => $input['scheduled_time'] ?? date('c'),
        'duration_minutes'       => $input['duration_minutes'] ?? 60,
        'late_threshold_minutes' => $input['late_threshold_minutes'] ?? 15,
        'status'                 => 'active',
    ]);

    successResponse($result[0] ?? $result, 'Session created successfully');
}
