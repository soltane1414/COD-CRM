<?php

declare(strict_types=1);

namespace App\Modules\AIInsights;

/**
 * Communicates with the Python ML microservice via HTTP.
 *
 * The ML service runs on a configurable host (default http://localhost:8001).
 * All responses follow the format: { "success": bool, "data": mixed }
 */
class AIInsightsService
{
    private string $mlServiceUrl;

    public function __construct()
    {
        $this->mlServiceUrl = rtrim(
            $_ENV['ML_SERVICE_URL'] ?? 'http://localhost:8001',
            '/'
        );
    }

    // ── Order Risk Prediction ────────────────────────────────

    /**
     * Get risk score for a single order.
     */
    public function getOrderRisk(array $orderData): array
    {
        return $this->post('/api/predict/order-risk', $orderData);
    }

    /**
     * Get risk scores for multiple orders.
     */
    public function getBatchOrderRisk(array $orders): array
    {
        return $this->post('/api/predict/order-risk/batch', ['orders' => $orders]);
    }

    // ── Customer Segmentation ────────────────────────────────

    /**
     * Get customer segmentation results.
     */
    public function getCustomerSegments(): array
    {
        return $this->get('/api/segment/customers');
    }

    /**
     * Get segment summary statistics.
     */
    public function getSegmentSummary(): array
    {
        return $this->get('/api/segment/summary');
    }

    // ── Demand Forecasting ───────────────────────────────────

    /**
     * Get demand forecast for a product category.
     */
    public function getDemandForecast(string $category = 'all', int $periods = 30): array
    {
        return $this->get('/api/forecast/demand', [
            'category' => $category,
            'periods'  => $periods,
        ]);
    }

    /**
     * List available forecast categories.
     */
    public function getForecastCategories(): array
    {
        return $this->get('/api/forecast/categories');
    }

    // ── AI Insights (LLM) ────────────────────────────────────

    /**
     * Get AI-generated business summary.
     */
    public function getInsightsSummary(string $lang = 'en', string $period = 'week'): array
    {
        return $this->get('/api/insights/summary', [
            'lang'   => $lang,
            'period' => $period,
        ]);
    }

    /**
     * Get natural language explanation of order risk.
     */
    public function getOrderRiskExplanation(float $score, array $reasons, string $lang = 'en'): array
    {
        return $this->get('/api/insights/order-explanation', [
            'score'   => $score,
            'reasons' => implode(',', $reasons),
            'lang'    => $lang,
        ]);
    }

    /**
     * Get AI-powered business recommendations.
     */
    public function getRecommendations(string $context, string $lang = 'en'): array
    {
        return $this->get('/api/insights/recommendations', [
            'context' => $context,
            'lang'    => $lang,
        ]);
    }

    // ── Health Check ─────────────────────────────────────────

    /**
     * Check if ML service is running.
     */
    public function healthCheck(): array
    {
        return $this->get('/api/health');
    }

    // ── HTTP Helpers ─────────────────────────────────────────

    private function get(string $path, array $params = []): array
    {
        $url = $this->mlServiceUrl . $path;
        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ['success' => false, 'error' => 'ML service unavailable: ' . $error];
        }

        if ($httpCode !== 200) {
            return [
                'success' => false,
                'error'   => "ML service returned HTTP $httpCode",
                'details' => json_decode($response, true),
            ];
        }

        return json_decode($response, true) ?: ['success' => false, 'error' => 'Invalid response'];
    }

    private function post(string $path, array $data): array
    {
        $url  = $this->mlServiceUrl . $path;
        $json = json_encode($data);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $json,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: application/json',
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ['success' => false, 'error' => 'ML service unavailable: ' . $error];
        }

        if ($httpCode !== 200) {
            return [
                'success' => false,
                'error'   => "ML service returned HTTP $httpCode",
                'details' => json_decode($response, true),
            ];
        }

        return json_decode($response, true) ?: ['success' => false, 'error' => 'Invalid response'];
    }

    /**
     * Upload a file to the ML service (multipart form).
     */
    public function postFile(string $path, string $filePath, string $fieldName = 'file'): array
    {
        $url = $this->mlServiceUrl . $path;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => [
                $fieldName => new \CURLFile($filePath, 'text/csv', 'database_export.csv'),
            ],
            CURLOPT_TIMEOUT        => 600, // Training can take minutes
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ['success' => false, 'error' => 'ML service unavailable: ' . $error];
        }

        if ($httpCode !== 200) {
            return [
                'success' => false,
                'error'   => "ML service returned HTTP $httpCode",
                'details' => json_decode($response, true),
            ];
        }

        return json_decode($response, true) ?: ['success' => false, 'error' => 'Invalid response'];
    }
}
