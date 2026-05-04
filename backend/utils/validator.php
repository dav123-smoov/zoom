<?php
/**
 * IAAMS - Name Validator & AI Fraud Detector
 * Intelligent features for attendance verification
 */

class NameValidator {
    /**
     * Validates the Name_MatrixNumber format
     * Expected: "Bolaji_259096010"
     */
    public function validate(string $displayName): array {
        if (empty(trim($displayName))) {
            return ['valid' => false, 'error' => 'Empty display name', 'name' => '', 'matrix_number' => ''];
        }
        if (strpos($displayName, '_') === false) {
            return ['valid' => false, 'error' => 'Missing underscore separator. Expected: Name_MatrixNumber', 'name' => $displayName, 'matrix_number' => ''];
        }
        $parts = explode('_', $displayName, 2);
        $name = trim($parts[0]);
        $matrix = trim($parts[1] ?? '');
        if (strlen($name) < 2 || !preg_match('/^[a-zA-Z\s]+$/', $name)) {
            return ['valid' => false, 'error' => "Invalid name part: '{$name}'. Must be 2+ alpha characters", 'name' => $name, 'matrix_number' => $matrix];
        }
        if (!preg_match('/^\d{6,12}$/', $matrix)) {
            return ['valid' => false, 'error' => "Invalid matrix number: '{$matrix}'. Must be 6-12 digits", 'name' => $name, 'matrix_number' => $matrix];
        }
        return ['valid' => true, 'name' => ucfirst(strtolower($name)), 'matrix_number' => $matrix, 'error' => null];
    }
}

class FraudDetector {
    private Database $db;
    public function __construct(Database $db) { $this->db = $db; }

    /**
     * AI-based fraud analysis
     * Checks: short duration, multiple logins, late patterns, suspicious behavior
     */
    public function analyze(string $studentId, string $sessionId, array $attendance): array {
        $alerts = [];
        // Check 1: Multiple logins in same session
        $records = $this->db->select('attendance', 'id,join_count', ['student_id' => "eq.{$studentId}", 'session_id' => "eq.{$sessionId}"]);
        if (!empty($records) && ($records[0]['join_count'] ?? 0) > 3) {
            $alerts[] = $this->createAlert($studentId, $sessionId, 'multiple_logins', 'medium',
                "Joined session " . $records[0]['join_count'] . " times (threshold: 3)");
        }
        // Check 2: Short duration (if leave_time exists)
        if (!empty($attendance['duration_seconds']) && $attendance['duration_seconds'] < 600) {
            $alerts[] = $this->createAlert($studentId, $sessionId, 'short_duration', 'high',
                "Only attended " . round($attendance['duration_seconds']/60, 1) . " minutes (threshold: 10 min)");
        }
        // Check 3: Late pattern - check history
        $history = $this->db->select('attendance', 'status', ['student_id' => "eq.{$studentId}"]);
        $total = count($history);
        $lateCount = count(array_filter($history, fn($h) => $h['status'] === 'late'));
        if ($total >= 3 && ($lateCount / $total) > 0.5) {
            $existing = $this->db->select('fraud_alerts', 'id',
                ['student_id' => "eq.{$studentId}", 'alert_type' => 'eq.late_pattern', 'resolved' => 'eq.false']);
            if (empty($existing)) {
                $alerts[] = $this->createAlert($studentId, $sessionId, 'late_pattern', 'medium',
                    "Late in {$lateCount}/{$total} sessions (" . round(($lateCount/$total)*100) . "%)");
            }
        }
        return $alerts;
    }

    private function createAlert(string $studentId, string $sessionId, string $type, string $severity, string $desc): array {
        $result = $this->db->insert('fraud_alerts', [
            'student_id' => $studentId, 'session_id' => $sessionId,
            'alert_type' => $type, 'severity' => $severity, 'description' => $desc,
        ]);
        return $result[0] ?? $result;
    }
}
