<?php
/**
 * IAAMS - Name Validator & AI Fraud Detector
 * Intelligent features for attendance verification
 */

class NameValidator {
    /**
     * Validates display name and extracts Name + Matrix Number
     * 
     * Accepted formats:
     *   "DAVID BOLAJI 220591122"          → Name: David Bolaji,    Matrix: 220591122
     *   "DAVID BOLAJI ABIODUN 220591122"  → Name: David Bolaji Abiodun, Matrix: 220591122
     *   "Bolaji_259096010"                → Name: Bolaji,          Matrix: 259096010
     * 
     * Rule: The LAST word/part must be a 6-12 digit matrix number.
     *       Everything before it is the student's name.
     */
    public function validate(string $displayName): array {
        $displayName = trim($displayName);
        if (empty($displayName)) {
            return ['valid' => false, 'error' => 'Empty display name', 'name' => '', 'matrix_number' => ''];
        }

        $name = '';
        $matrix = '';

        // Method 1: Try underscore format first (e.g. "Bolaji_259096010")
        if (strpos($displayName, '_') !== false) {
            $parts = explode('_', $displayName, 2);
            $name = trim($parts[0]);
            $matrix = trim($parts[1] ?? '');
        }

        // Method 2: Space-separated — last word is matrix number
        // e.g. "DAVID BOLAJI 220591122" or "DAVID BOLAJI ABIODUN 220591122"
        if (empty($matrix) || !preg_match('/^\d{6,12}$/', $matrix)) {
            $words = preg_split('/\s+/', $displayName);
            if (count($words) >= 2) {
                $lastWord = array_pop($words);
                if (preg_match('/^\d{6,12}$/', $lastWord)) {
                    $matrix = $lastWord;
                    $name = implode(' ', $words);
                }
            }
        }

        // Validate name part
        if (strlen($name) < 2 || !preg_match('/^[a-zA-Z\s\-\.]+$/', $name)) {
            return ['valid' => false, 'error' => "Could not extract a valid name from: '{$displayName}'", 'name' => $displayName, 'matrix_number' => ''];
        }

        // Validate matrix number
        if (!preg_match('/^\d{6,12}$/', $matrix)) {
            return ['valid' => false, 'error' => "Could not find a valid matrix number (6-12 digits) in: '{$displayName}'", 'name' => $name, 'matrix_number' => ''];
        }

        // Format name: capitalize each word
        $formattedName = ucwords(strtolower($name));

        return ['valid' => true, 'name' => $formattedName, 'matrix_number' => $matrix, 'error' => null];
    }
}

class FraudDetector {
    private Database $db;
    public function __construct(Database $db) { $this->db = $db; }

    /**
     * Session-scoped fraud analysis.
     * Checks: short duration, multiple logins in same session.
     * Uses matrix_number + session_id for lookups — no students table.
     */
    public function analyze(string $studentName, string $matrixNumber, string $sessionId, array $attendance): array {
        $alerts = [];

        // Check 1: Multiple logins in same session (same matrix_number joined > 3 times)
        $records = $this->db->select('attendance', 'id,join_count', [
            'matrix_number' => "eq.{$matrixNumber}",
            'session_id'    => "eq.{$sessionId}"
        ]);
        if (!empty($records) && ($records[0]['join_count'] ?? 0) > 3) {
            $alerts[] = $this->createAlert($studentName, $matrixNumber, $sessionId, 'multiple_logins', 'medium',
                "Joined session " . $records[0]['join_count'] . " times (threshold: 3)");
        }

        // Check 2: Short duration (if duration_seconds is provided at join time)
        if (!empty($attendance['duration_seconds']) && $attendance['duration_seconds'] < 600) {
            $alerts[] = $this->createAlert($studentName, $matrixNumber, $sessionId, 'short_duration', 'high',
                "Only attended " . round($attendance['duration_seconds'] / 60, 1) . " minutes (threshold: 10 min)");
        }

        return $alerts;
    }

    private function createAlert(string $studentName, string $matrixNumber, string $sessionId, string $type, string $severity, string $desc): array {
        // Prevent duplicate unresolved alerts of the same type for same matrix + session
        $existing = $this->db->select('fraud_alerts', 'id', [
            'matrix_number' => "eq.{$matrixNumber}",
            'session_id'    => "eq.{$sessionId}",
            'alert_type'    => "eq.{$type}",
            'resolved'      => "eq.false"
        ]);
        if (!empty($existing)) {
            return $existing[0];
        }

        $result = $this->db->insert('fraud_alerts', [
            'student_name'  => $studentName,
            'matrix_number' => $matrixNumber,
            'session_id'    => $sessionId,
            'alert_type'    => $type,
            'severity'      => $severity,
            'description'   => $desc,
        ]);
        return $result[0] ?? $result;
    }
}
