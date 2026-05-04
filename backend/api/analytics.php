<?php
/**
 * IAAMS - Analytics API (OPTIMIZED)
 * Uses PostgreSQL RPC functions for single-call data retrieval
 */

function handleAnalytics(Database $db, string $method, array $segments) {
    if ($method !== 'GET') { errorResponse('Method not allowed', 405); return; }
    $action = $segments[1] ?? '';
    switch ($action) {
        case 'attendance-trends': getAttendanceTrends($db); break;
        case 'fraud-alerts': getFraudAlerts($db); break;
        case 'trust-distribution': getTrustDistribution($db); break;
        default: errorResponse('Unknown analytics endpoint', 404);
    }
}

function getAttendanceTrends(Database $db) {
    // OPTIMIZED: Single RPC call replaces N+1 queries
    $result = $db->rpc('get_attendance_trends');
    successResponse($result ?? []);
}

function getFraudAlerts(Database $db) {
    // OPTIMIZED: Single RPC call with JOINs done in SQL
    $result = $db->rpc('get_fraud_alerts');
    successResponse($result ?? []);
}

function getTrustDistribution(Database $db) {
    // OPTIMIZED: Single RPC call with bucket aggregation in SQL
    $result = $db->rpc('get_trust_distribution');
    successResponse($result ?? []);
}
