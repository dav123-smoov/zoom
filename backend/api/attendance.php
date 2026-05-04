<?php
/**
 * IAAMS - Attendance API
 * Records and manages attendance entries
 *
 * SQL Operations:
 *   SELECT * FROM attendance JOIN students JOIN sessions
 *   INSERT INTO attendance (student_id, session_id, ...) VALUES (...)
 *   UPDATE attendance SET status = ?, leave_time = ? WHERE id = ?
 */

function handleAttendance(Database $db, string $method, array $segments) {
    $id = $segments[1] ?? null;

    switch ($method) {
        case 'GET':
            if ($id) {
                getAttendanceRecord($db, $id);
            } else {
                listAttendance($db);
            }
            break;
        case 'POST':
            createAttendance($db);
            break;
        case 'PATCH':
        case 'PUT':
            if ($id) updateAttendance($db, $id);
            else errorResponse('Attendance ID required', 400);
            break;
        default:
            errorResponse('Method not allowed', 405);
    }
}

function listAttendance(Database $db) {
    $filters = [];
    if (isset($_GET['session_id']))  $filters['session_id'] = "eq.{$_GET['session_id']}";
    if (isset($_GET['student_id']))  $filters['student_id'] = "eq.{$_GET['student_id']}";
    if (isset($_GET['status']))      $filters['status']     = "eq.{$_GET['status']}";

    // SQL: SELECT a.*, s.name, s.matrix_number, sess.topic
    //      FROM attendance a
    //      JOIN students s ON a.student_id = s.id
    //      JOIN sessions sess ON a.session_id = sess.id
    //      WHERE ... ORDER BY join_time DESC LIMIT 100
    $records = $db->select(
        'attendance',
        '*,students!inner(name,matrix_number,trust_score),sessions!inner(topic,course_code)',
        $filters,
        'join_time.desc',
        100
    );

    $result = array_map(function ($a) {
        return [
            'id'               => $a['id'],
            'student_name'     => $a['students']['name'],
            'matrix_number'    => $a['students']['matrix_number'],
            'trust_score'      => (float)$a['students']['trust_score'],
            'session_topic'    => $a['sessions']['topic'],
            'course_code'      => $a['sessions']['course_code'],
            'join_time'        => $a['join_time'],
            'leave_time'       => $a['leave_time'],
            'duration_seconds' => $a['duration_seconds'],
            'status'           => $a['status'],
            'is_suspicious'    => $a['is_suspicious'],
            'join_count'       => $a['join_count'],
        ];
    }, $records);

    successResponse($result);
}

function getAttendanceRecord(Database $db, string $id) {
    $result = $db->select(
        'attendance',
        '*,students!inner(name,matrix_number),sessions!inner(topic)',
        ['id' => "eq.{$id}"]
    );
    if (empty($result)) {
        errorResponse('Attendance record not found', 404);
        return;
    }
    successResponse($result[0]);
}

function createAttendance(Database $db) {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || !isset($input['student_id'], $input['session_id'])) {
        errorResponse('Missing required fields: student_id, session_id', 400);
        return;
    }

    // SQL: INSERT INTO attendance (student_id, session_id, join_time, status, raw_display_name)
    //      VALUES ($student_id, $session_id, NOW(), $status, $display_name)
    $result = $db->insert('attendance', [
        'student_id'       => $input['student_id'],
        'session_id'       => $input['session_id'],
        'join_time'        => $input['join_time'] ?? date('c'),
        'status'           => $input['status'] ?? 'present',
        'raw_display_name' => $input['raw_display_name'] ?? '',
        'is_suspicious'    => $input['is_suspicious'] ?? false,
    ]);

    successResponse($result[0] ?? $result, 'Attendance recorded');
}

function updateAttendance(Database $db, string $id) {
    $input = json_decode(file_get_contents('php://input'), true);

    $updateData = [];
    if (isset($input['status']))           $updateData['status'] = $input['status'];
    if (isset($input['leave_time']))       $updateData['leave_time'] = $input['leave_time'];
    if (isset($input['duration_seconds'])) $updateData['duration_seconds'] = $input['duration_seconds'];
    if (isset($input['is_suspicious']))    $updateData['is_suspicious'] = $input['is_suspicious'];

    if (empty($updateData)) {
        errorResponse('No fields to update', 400);
        return;
    }

    // SQL: UPDATE attendance SET status = ?, leave_time = ? WHERE id = $id RETURNING *
    $result = $db->update('attendance', $updateData, ['id' => "eq.{$id}"]);

    if (empty($result)) {
        errorResponse('Record not found', 404);
        return;
    }

    successResponse($result[0], 'Attendance updated');
}
