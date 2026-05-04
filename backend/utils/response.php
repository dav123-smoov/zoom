<?php
/** IAAMS - JSON Response Helpers */
function successResponse($data, string $message = 'Success'): void {
    echo json_encode(['success' => true, 'message' => $message, 'data' => $data]);
    exit();
}
function errorResponse(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit();
}
