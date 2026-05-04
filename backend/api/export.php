<?php
/**
 * IAAMS - CSV Export API
 */
function handleExport(Database $db, string $method, array $segments) {
    if ($method !== 'GET') { errorResponse('Method not allowed', 405); return; }
    $type = $segments[1] ?? '';
    $id   = $segments[2] ?? null;
    if ($type === 'csv' && $id) { exportSessionCSV($db, $id); }
    else { errorResponse('Use /api/export/csv/{session_id}', 400); }
}

function exportSessionCSV(Database $db, string $sessionId) {
    $session = $db->select('sessions', 'topic,course_code,scheduled_time', ['id' => "eq.{$sessionId}"]);
    if (empty($session)) { errorResponse('Session not found', 404); return; }
    $sess = $session[0];
    $records = $db->select('attendance',
        'join_time,leave_time,duration_seconds,status,is_suspicious,students!inner(name,matrix_number,trust_score)',
        ['session_id' => "eq.{$sessionId}"], 'join_time.asc');
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="attendance_' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['IAAMS Attendance Report']);
    fputcsv($out, ['Session', $sess['topic'], 'Course', $sess['course_code'], 'Date', $sess['scheduled_time']]);
    fputcsv($out, []);
    fputcsv($out, ['Name','Matrix Number','Join Time','Leave Time','Duration (min)','Status','Suspicious','Trust Score']);
    foreach ($records as $r) {
        fputcsv($out, [
            $r['students']['name'], $r['students']['matrix_number'],
            $r['join_time'], $r['leave_time'] ?? '',
            round(($r['duration_seconds'] ?? 0) / 60), $r['status'],
            $r['is_suspicious'] ? 'Yes' : 'No', $r['students']['trust_score'],
        ]);
    }
    fclose($out);
    exit();
}
