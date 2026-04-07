<?php

declare(strict_types=1);

namespace App\Modules\Order;

use App\Core\Database;

class OrderService
{
    private const ML_FEATURE_KEYS = [
        'estimated_delivery_days',
        'avg_product_weight',
        'avg_photos',
        'avg_desc_length',
        'avg_name_length',
        'avg_volume',
        'seller_customer_same_state',
        'n_sellers',
        'product_category',
    ];

    private OrderRepository $repo;
    private Database $db;

    public function __construct()
    {
        $this->repo = new OrderRepository();
        $this->db = Database::getInstance();
    }

    public function list(int $storeId, int $page, int $perPage, array $filters): array
    {
        $result = $this->repo->paginate($storeId, $page, $perPage, $filters);
        $result['data'] = array_map(fn(array $o) => $this->hydrateOrder($o), $result['data']);
        return $result;
    }

    public function getById(int $id, int $storeId): ?array
    {
        $order = $this->repo->findById($id, $storeId);
        if ($order) {
            $order = $this->hydrateOrder($order);
            $order['items'] = $this->repo->getOrderItems($id);
            $order['history'] = $this->repo->getStatusHistory($id);
        }
        return $order;
    }

    public function create(int $storeId, int $userId, array $data): array
    {
        $this->db->beginTransaction();

        try {
            $items = $this->normalizeItems($data['items'] ?? []);

            // Calculate totals
            $subtotal = 0;
            foreach ($items as $item) {
                $subtotal += (float)$item['price'] * (int)$item['quantity'];
            }

            $shippingCost = max(0.0, (float)($data['shipping_cost'] ?? 0));
            $discount = max(0.0, (float)($data['discount'] ?? 0));
            $totalAmount = max(0.0, $subtotal + $shippingCost - $discount);

            // Generate order reference
            $reference = $this->generateReference($storeId);

            $source = trim((string)($data['source'] ?? 'manual'));
            if ($source === '') {
                $source = 'manual';
            }

            $mlUpdate = $this->resolveMlFeatureUpdate($data, []);
            $mlFeatures = !empty($mlUpdate['features'])
                ? json_encode($mlUpdate['features'], JSON_UNESCAPED_UNICODE)
                : null;

            $orderId = $this->db->insert('orders', [
                'store_id'       => $storeId,
                'reference'      => $reference,
                'customer_name'  => $data['customer_name'],
                'customer_phone' => $data['customer_phone'],
                'customer_phone_2' => $data['customer_phone_2'] ?? null,
                'wilaya_id'      => (int)$data['wilaya_id'],
                'commune'        => $data['commune'],
                'address'        => $data['address'],
                'subtotal'       => $subtotal,
                'shipping_cost'  => $shippingCost,
                'discount'       => $discount,
                'total_amount'   => $totalAmount,
                'status'         => 'new',
                'notes'          => $data['notes'] ?? null,
                'internal_notes' => $data['internal_notes'] ?? null,
                'source'         => $source,
                'ml_features'    => $mlFeatures,
                'created_by'     => $userId,
                'created_at'     => date('Y-m-d H:i:s'),
                'updated_at'     => date('Y-m-d H:i:s'),
            ]);

            // Insert order items
            $productNameMap = $this->buildProductNameMap($storeId, $items);
            foreach ($items as $item) {
                $this->db->insert('order_items', [
                    'order_id'   => $orderId,
                    'product_id' => (int)$item['product_id'],
                    'product_name' => $productNameMap[(int)$item['product_id']] ?? null,
                    'quantity'   => (int)$item['quantity'],
                    'price'      => (float)$item['price'],
                    'total'      => (float)$item['price'] * (int)$item['quantity'],
                ]);
            }

            // Record status history
            $this->db->insert('order_status_history', [
                'order_id'   => $orderId,
                'status'     => 'new',
                'changed_by' => $userId,
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            $this->db->commit();

            return $this->getById($orderId, $storeId);
        } catch (\Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    public function update(int $id, int $storeId, array $data): ?array
    {
        $order = $this->repo->findById($id, $storeId);
        if (!$order) {
            return null;
        }

        $allowed = [
            'customer_name',
            'customer_phone',
            'customer_phone_2',
            'wilaya_id',
            'commune',
            'address',
            'shipping_cost',
            'discount',
            'notes',
            'internal_notes',
            'source',
        ];

        $filtered = array_intersect_key($data, array_flip($allowed));

        if (array_key_exists('shipping_cost', $filtered)) {
            $filtered['shipping_cost'] = max(0.0, (float)$filtered['shipping_cost']);
        }
        if (array_key_exists('discount', $filtered)) {
            $filtered['discount'] = max(0.0, (float)$filtered['discount']);
        }
        if (array_key_exists('source', $filtered)) {
            $source = trim((string)$filtered['source']);
            $filtered['source'] = $source !== '' ? $source : 'manual';
        }

        $existingMl = $this->decodeMlFeatures($order['ml_features'] ?? null);
        $mlUpdate = $this->resolveMlFeatureUpdate($data, $existingMl);
        if ($mlUpdate['touched']) {
            $filtered['ml_features'] = !empty($mlUpdate['features'])
                ? json_encode($mlUpdate['features'], JSON_UNESCAPED_UNICODE)
                : null;
        }

        $hasItems = isset($data['items']) && is_array($data['items']);
        $items = [];
        if ($hasItems) {
            $items = $this->normalizeItems($data['items']);
        }

        $subtotal = (float)$order['subtotal'];
        if ($hasItems) {
            $subtotal = 0.0;
            foreach ($items as $item) {
                $subtotal += (float)$item['price'] * (int)$item['quantity'];
            }
        }

        $shippingCost = array_key_exists('shipping_cost', $filtered)
            ? (float)$filtered['shipping_cost']
            : (float)$order['shipping_cost'];
        $discount = array_key_exists('discount', $filtered)
            ? (float)$filtered['discount']
            : (float)($order['discount'] ?? 0);

        if ($hasItems || array_key_exists('shipping_cost', $filtered) || array_key_exists('discount', $filtered)) {
            $filtered['subtotal'] = $subtotal;
            $filtered['shipping_cost'] = $shippingCost;
            $filtered['discount'] = $discount;
            $filtered['total_amount'] = max(0.0, $subtotal + $shippingCost - $discount);
        }

        $filtered['updated_at'] = date('Y-m-d H:i:s');

        $this->db->beginTransaction();
        try {
            $this->repo->update($id, $storeId, $filtered);

            if ($hasItems) {
                $this->db->delete('order_items', 'order_id = ?', [$id]);
                $productNameMap = $this->buildProductNameMap($storeId, $items);

                foreach ($items as $item) {
                    $this->db->insert('order_items', [
                        'order_id'     => $id,
                        'product_id'   => (int)$item['product_id'],
                        'product_name' => $productNameMap[(int)$item['product_id']] ?? null,
                        'quantity'     => (int)$item['quantity'],
                        'price'        => (float)$item['price'],
                        'total'        => (float)$item['price'] * (int)$item['quantity'],
                    ]);
                }
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollback();
            throw $e;
        }

        return $this->getById($id, $storeId);
    }

    public function updateStatus(int $id, int $storeId, string $status, int $userId): ?array
    {
        $order = $this->repo->findById($id, $storeId);
        if (!$order) {
            return null;
        }

        // Validate status transition
        $this->validateStatusTransition($order['status'], $status);

        $this->db->beginTransaction();

        try {
            $this->repo->update($id, $storeId, [
                'status'     => $status,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            $this->db->insert('order_status_history', [
                'order_id'   => $id,
                'status'     => $status,
                'changed_by' => $userId,
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            $this->db->commit();
            return $this->getById($id, $storeId);
        } catch (\Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    public function delete(int $id, int $storeId): bool
    {
        return $this->repo->delete($id, $storeId);
    }

    private function generateReference(int $storeId): string
    {
        $count = $this->db->count('orders', 'store_id = ?', [$storeId]);
        return sprintf('ORD-%d-%06d', $storeId, $count + 1);
    }

    /**
     * COD order status flow:
     * new → confirmed → processing → shipped → delivered
     *                                       → returned
     * new → no_answer → (can go back to confirmed)
     * new → cancelled
     * new → postponed → (can go back to new)
     */
    private function validateStatusTransition(string $from, string $to): void
    {
        $allowed = [
            'new'        => ['confirmed', 'cancelled', 'no_answer', 'postponed'],
            'confirmed'  => ['processing', 'cancelled'],
            'processing' => ['shipped', 'cancelled'],
            'shipped'    => ['delivered', 'returned'],
            'no_answer'  => ['confirmed', 'cancelled', 'postponed'],
            'postponed'  => ['new', 'cancelled'],
            'delivered'  => ['returned'], // allow return after delivery
            'returned'   => [],
            'cancelled'  => [],
        ];

        if (!in_array($to, $allowed[$from] ?? [], true)) {
            throw new \RuntimeException(
                "Invalid status transition: {$from} → {$to}",
                422
            );
        }
    }

    /**
     * Normalize and validate order items.
     */
    private function normalizeItems(array $items): array
    {
        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $productId = (int)($item['product_id'] ?? 0);
            $quantity = (int)($item['quantity'] ?? 0);
            $price = (float)($item['price'] ?? 0);

            if ($productId <= 0 || $quantity <= 0 || $price < 0) {
                continue;
            }

            $normalized[] = [
                'product_id' => $productId,
                'quantity' => $quantity,
                'price' => $price,
            ];
        }

        if (empty($normalized)) {
            throw new \RuntimeException('At least one valid order item is required.', 422);
        }

        return $normalized;
    }

    /**
     * Build product ID → product name map for order item snapshots.
     */
    private function buildProductNameMap(int $storeId, array $items): array
    {
        $productIds = array_values(array_unique(array_map(
            static fn(array $item): int => (int)$item['product_id'],
            $items
        )));

        if (empty($productIds)) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($productIds), '?'));
        $params = array_merge([$storeId], $productIds);
        $rows = $this->db->query(
            "SELECT id, name FROM products WHERE store_id = ? AND id IN ({$placeholders})",
            $params
        );

        $map = [];
        foreach ($rows as $row) {
            $map[(int)$row['id']] = $row['name'];
        }

        return $map;
    }

    /**
     * Decode order ml_features JSON safely.
     */
    private function decodeMlFeatures(mixed $raw): array
    {
        if (is_array($raw)) {
            return $raw;
        }
        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Merge incoming ML feature fields with existing values.
     */
    private function resolveMlFeatureUpdate(array $data, array $existing): array
    {
        $incoming = [];

        if (isset($data['ml_features']) && is_array($data['ml_features'])) {
            $incoming = array_merge($incoming, $data['ml_features']);
        }

        foreach (self::ML_FEATURE_KEYS as $key) {
            if (array_key_exists($key, $data)) {
                $incoming[$key] = $data[$key];
            }
        }

        $touched = array_key_exists('ml_features', $data) || !empty($incoming);
        if (!$touched) {
            return ['touched' => false, 'features' => $existing];
        }

        $features = $existing;
        foreach (self::ML_FEATURE_KEYS as $key) {
            if (!array_key_exists($key, $incoming)) {
                continue;
            }

            $value = $this->normalizeMlFeatureValue($key, $incoming[$key]);
            if ($value === null) {
                unset($features[$key]);
            } else {
                $features[$key] = $value;
            }
        }

        return ['touched' => true, 'features' => $features];
    }

    /**
     * Normalize a single ML feature value from user input.
     */
    private function normalizeMlFeatureValue(string $key, mixed $value): mixed
    {
        if ($value === null || (is_string($value) && trim($value) === '')) {
            return null;
        }

        if ($key === 'product_category') {
            $clean = trim((string)$value);
            return $clean !== '' ? $clean : null;
        }

        if (in_array($key, ['estimated_delivery_days', 'n_sellers'], true)) {
            $intVal = (int)$value;
            return $intVal >= 1 ? $intVal : null;
        }

        if ($key === 'seller_customer_same_state') {
            $intVal = (int)$value;
            return in_array($intVal, [0, 1], true) ? $intVal : null;
        }

        $floatVal = (float)$value;
        return $floatVal >= 0 ? $floatVal : null;
    }

    /**
     * Decode JSON fields for API responses.
     */
    private function hydrateOrder(array $order): array
    {
        $order['ml_features'] = $this->decodeMlFeatures($order['ml_features'] ?? null);
        return $order;
    }
}
