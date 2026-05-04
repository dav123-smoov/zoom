<?php
/**
 * IAAMS - Students API
 * Manages student records, trust scores, and alerts
 *
 * SQL Operations:
 *   SELECT * FROM students ORDER BY name ASC
 *   SELECT * FROM students WHERE name ILIKE '%search%'
 *   SELECT * FROM fraud_alerts WHERE student_id = ?
 */

function handleStudents(Database $db, string $method, array $segments) {
    $id     = $segments[1] ?? null;
    $action = $segments[2] ?? null;

    switch ($method) {
        case 'GET':
            if ($id && $action === 'trust-score') {
                getStudentTrustScore($db, $id);
            } elseif ($id && $action === 'history') {
                getStudentHistory($db, $id);
            } elseif ($id) {
                getStudent($db, $id);
            } else {
                listStudents($db);
            }
            break;
        default:
            errorResponse('Method not allowed', 405);
    }
}

function listStudents(Database $db) {
    $search = $_GET['search'] ?? '';
    $page   = (int)($_GET['page'] ?? 1);
    $limit  = (int)($_GET['limit'] ?? 50);
    $offset = ($page - 1) * $limit;

    $filters = [];
    if ($search) {
        // SQL: WHERE name ILIKE '%search%' OR matrix_number ILIKE '%search%'
        $filters['or'] = "(name.ilike.%{$search}%,matrix_number.ilike.%{$search}%)";
    }

    // SQL: SELECT * FROM students WHERE ... ORDER BY name ASC LIMIT $limit OFFSET $offset
    $students = $db->select('students', '*', $filters, 'name.asc', $limit, $offset);

    // Get alert counts for these students
    // SQL: SELECT student_id, COUNT(*) FROM fraud_alerts WHERE resolved = false GROUP BY student_id
    $alerts = $db->select('fraud_alerts', 'student_id', ['resolved' => 'eq.false']);
    $alertCounts = [];
    foreach ($alerts as $alert) {
        $sid = $alert['student_id'];
        $alertCounts[$sid] = ($alertCounts[$sid] ?? 0) + 1;
    }

    // Enrich student data with alert counts
    $enriched = array_map(function ($s) use ($alertCounts) {
        $s['trust_score']   = (float)$s['trust_score'];
        $s['active_alerts'] = $alertCounts[$s['id']] ?? 0;
        return $s;
    }, $students);

    // Get total count for pagination
    $all = $db->select('students', 'id', $filters);

    successResponse([
        'data'       => $enriched,
        'pagination' => [
            'total'       => count($all),
            'page'        => $page,
            'limit'       => $limit,
            'total_pages' => ceil(count($all) / $limit),
        ]
    ]);
}

function getStudent(Database $db, string $id) {
    // SQL: SELECT * FROM students WHERE id = $id
    $result = $db->select('students', '*', ['id' => "eq.{$id}"]);
    if (empty($result)) {
        errorResponse('Student not found', 404);
        return;
    }
    $student = $result[0];
    $student['trust_score'] = (float)$student['trust_score'];
    successResponse($student);
}

function getStudentTrustScore(Database $db, string $id) {
    // SQL: SELECT * FROM students WHERE id = $id
    $result = $db->select('students', 'id,name,trust_score', ['id' => "eq.{$id}"]);
    if (empty($result)) {
        errorResponse('Student not found', 404);
        return;
    }

    // SQL: SELECT * FROM attendance WHERE student_id = $id
    $attendance = $db->select('attendance', 'status,duration_seconds,join_time', ['student_id' => "eq.{$id}"]);

    $total     = count($attendance);
    $present   = count(array_filter($attendance, fn($a) => $a['status'] === 'present'));
    $late      = count(array_filter($attendance, fn($a) => $a['status'] === 'late'));

    // Calculate trust score components
    $attendanceRate = $total > 0 ? round((($present + $late) / $total) * 100, 1) : 0;
    $punctualityRate = $total > 0 ? round(($present / max($present + $late, 1)) * 100, 1) : 0;
    $avgDuration = $total > 0
        ? round(array_sum(array_column($attendance, 'duration_seconds')) / $total / 60, 1)
        : 0;

    successResponse([
        'student'          => $result[0],
        'attendance_rate'  => $attendanceRate,
        'punctuality_rate' => $punctualityRate,
        'avg_duration_min' => $avgDuration,
        'total_sessions'   => $total,
        'present_count'    => $present,
        'late_count'       => $late,
        'absent_count'     => $total - $present - $late,
        'trust_breakdown'  => [
            'attendance_weight'  => 40,
            'punctuality_weight' => 25,
            'duration_weight'    => 20,
            'consistency_weight' => 15,
        ]
    ]);
}

function getStudentHistory(Database $db, string $id) {
    // SQL: SELECT a.*, sess.topic, sess.course_code
    //      FROM attendance a
    //      JOIN sessions sess ON a.session_id = sess.id
    //      WHERE a.student_id = $id
    //      ORDER BY a.join_time DESC
    $records = $db->select(
        'attendance',
        'id,join_time,leave_time,duration_seconds,status,is_suspicious,sessions!inner(topic,course_code,scheduled_time)',
        ['student_id' => "eq.{$id}"],
        'join_time.desc'
    );

    $history = array_map(function ($a) {
        return [
            'id'               => $a['id'],
            'session_topic'    => $a['sessions']['topic'],
            'course_code'      => $a['sessions']['course_code'],
            'scheduled_time'   => $a['sessions']['scheduled_time'],
            'join_time'        => $a['join_time'],
            'leave_time'       => $a['leave_time'],
            'duration_seconds' => $a['duration_seconds'],
            'status'           => $a['status'],
            'is_suspicious'    => $a['is_suspicious'],
        ];
    }, $records);

    successResponse($history);
}
