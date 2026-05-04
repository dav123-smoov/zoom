<?php
/**
 * IAAMS - Supabase Database Connection
 * Connects PHP to Supabase PostgreSQL via PostgREST API
 * Uses service_role key for server-side operations
 * 
 * Architecture: React → PHP API → Supabase PostgreSQL
 */

class Database {
    private string $supabaseUrl;
    private string $serviceKey;
    private string $anonKey;

    public function __construct() {
        // Supabase project credentials
        $this->supabaseUrl = 'https://uuyhlzsqzylvsucrxcjs.supabase.co';
        $this->serviceKey  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1eWhsenNxenlsdnN1Y3J4Y2pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg3NDk1OCwiZXhwIjoyMDkzNDUwOTU4fQ.UBiINCgC8k-ESde2nP6TuYg0gWDP7-2On_amqCeniBU';
        $this->anonKey     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1eWhsenNxenlsdnN1Y3J4Y2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NzQ5NTgsImV4cCI6MjA5MzQ1MDk1OH0.jY122hC_lbM8QpuVsURxZB5ZoYAxHgGZTLNScPelx6c';
    }

    /**
     * Execute a SELECT query via PostgREST
     * Translates SQL-like parameters into PostgREST REST calls
     *
     * @param string $table     - Table name (e.g., 'students')
     * @param string $select    - Columns to select (e.g., 'id,name,trust_score')
     * @param array  $filters   - Associative array of filters ['column' => 'eq.value']
     * @param string $order     - Order clause (e.g., 'name.asc')
     * @param int    $limit     - Row limit
     * @param int    $offset    - Row offset for pagination
     * @return array            - Query results
     */
    public function select(
        string $table,
        string $select = '*',
        array $filters = [],
        string $order = '',
        int $limit = 100,
        int $offset = 0
    ): array {
        $params = ['select' => $select];
        foreach ($filters as $col => $condition) {
            $params[$col] = $condition;
        }
        if ($order)  $params['order']  = $order;
        if ($limit)  $params['limit']  = $limit;
        if ($offset) $params['offset'] = $offset;

        $url = "{$this->supabaseUrl}/rest/v1/{$table}?" . http_build_query($params);
        return $this->request('GET', $url);
    }

    /**
     * Execute a SELECT query with COUNT header
     * Returns both data and total count for pagination
     */
    public function selectWithCount(
        string $table,
        string $select = '*',
        array $filters = [],
        string $order = '',
        int $limit = 100,
        int $offset = 0
    ): array {
        $params = ['select' => $select];
        foreach ($filters as $col => $condition) {
            $params[$col] = $condition;
        }
        if ($order)  $params['order']  = $order;
        if ($limit)  $params['limit']  = $limit;
        if ($offset) $params['offset'] = $offset;

        $url = "{$this->supabaseUrl}/rest/v1/{$table}?" . http_build_query($params);
        return $this->request('GET', $url, null, ['Prefer: count=exact']);
    }

    /**
     * INSERT a new row into a table
     * Equivalent to: INSERT INTO $table (...) VALUES (...)
     */
    public function insert(string $table, array $data, bool $returnData = true): array {
        $url = "{$this->supabaseUrl}/rest/v1/{$table}";
        $headers = $returnData ? ['Prefer: return=representation'] : [];
        return $this->request('POST', $url, $data, $headers);
    }

    /**
     * UPDATE rows in a table matching filters
     * Equivalent to: UPDATE $table SET ... WHERE ...
     */
    public function update(string $table, array $data, array $filters): array {
        $params = [];
        foreach ($filters as $col => $condition) {
            $params[$col] = $condition;
        }
        $url = "{$this->supabaseUrl}/rest/v1/{$table}?" . http_build_query($params);
        return $this->request('PATCH', $url, $data, ['Prefer: return=representation']);
    }

    /**
     * DELETE rows from a table matching filters
     * Equivalent to: DELETE FROM $table WHERE ...
     */
    public function delete(string $table, array $filters): array {
        $params = [];
        foreach ($filters as $col => $condition) {
            $params[$col] = $condition;
        }
        $url = "{$this->supabaseUrl}/rest/v1/{$table}?" . http_build_query($params);
        return $this->request('DELETE', $url);
    }

    /**
     * UPSERT - Insert or Update on conflict
     * Equivalent to: INSERT ... ON CONFLICT DO UPDATE
     */
    public function upsert(string $table, array $data): array {
        $url = "{$this->supabaseUrl}/rest/v1/{$table}";
        $headers = ['Prefer: return=representation,resolution=merge-duplicates'];
        return $this->request('POST', $url, $data, $headers);
    }

    /**
     * Call a PostgreSQL RPC function
     * Equivalent to: SELECT function_name(args)
     * Used for complex SQL operations like trust score calculation
     */
    public function rpc(string $functionName, array $params = []): array {
        $url = "{$this->supabaseUrl}/rest/v1/rpc/{$functionName}";
        return $this->request('POST', $url, $params);
    }

    /**
     * Execute raw SQL via the Management API
     * Only for admin operations - uses the access token
     */
    public function rawSQL(string $query): array {
        // This would require the Supabase Management API access token
        // For production, prefer using RPC functions instead
        throw new \RuntimeException('Raw SQL requires Management API access token');
    }

    /**
     * Core HTTP request handler
     * Sends authenticated requests to Supabase REST API
     */
    private function request(string $method, string $url, ?array $body = null, array $extraHeaders = []): array {
        $headers = [
            "apikey: {$this->serviceKey}",
            "Authorization: Bearer {$this->serviceKey}",
            "Content-Type: application/json",
        ];
        $headers = array_merge($headers, $extraHeaders);

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        switch ($method) {
            case 'POST':
                curl_setopt($ch, CURLOPT_POST, true);
                if ($body) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
                break;
            case 'PATCH':
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
                if ($body) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
                break;
            case 'DELETE':
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
                break;
        }

        $response   = curl_exec($ch);
        $httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error      = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new \RuntimeException("Supabase request failed: {$error}");
        }

        if ($httpCode >= 400) {
            $errorBody = json_decode($response, true);
            $message   = $errorBody['message'] ?? $errorBody['error'] ?? 'Unknown error';
            throw new \RuntimeException("Supabase error ({$httpCode}): {$message}");
        }

        return json_decode($response, true) ?? [];
    }

    /**
     * Get the Supabase URL (for building REST endpoints)
     */
    public function getUrl(): string {
        return $this->supabaseUrl;
    }
}
