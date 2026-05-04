<?php
/**
 * IAAMS - Dashboard API (OPTIMIZED v2)
 * 
 * PERFORMANCE FIX:
 *   Before: React made 4 API calls → PHP made 6+ Supabase calls = ~6 seconds
 *   After:  React makes 1 API call → PHP makes 1 RPC call = ~1 second
 * 
 * SQL: SELECT get_dashboard_all() — returns stats, trends, distribution, activity in one query
 */

function handleDashboard(Database $db, string $method, array $segments) {
    if ($method !== 'GET') { errorResponse('Method not allowed', 405); return; }
    $action = $segments[1] ?? 'all';
    switch ($action) {
        case 'all':   getDashboardAll($db); break;
        case 'stats': getDashboardStats($db); break;
        case 'recent-activity': getRecentActivity($db); break;
        default: errorResponse('Unknown dashboard endpoint', 404);
    }
}

/**
 * OPTIMIZED: Returns ALL dashboard data in a single database call
 * Replaces 4 separate React API calls with 1
 */
function getDashboardAll(Database $db) {
    $result = $db->rpc('get_dashboard_all');
    successResponse($result);
}

function getDashboardStats(Database $db) {
    $result = $db->rpc('get_dashboard_stats');
    successResponse($result);
}

function getRecentActivity(Database $db) {
    $result = $db->rpc('get_recent_activity');
    successResponse($result ?? []);
}
