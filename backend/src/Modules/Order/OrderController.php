<?php

declare(strict_types=1);

namespace App\Modules\Order;

use App\Core\Request;
use App\Core\Response;
use App\Core\Helpers\Validator;

class OrderController
{
    private OrderService $service;

    public function __construct()
    {
        $this->service = new OrderService();
    }

    /**
     * GET /api/v1/orders
     */
    public function index(Request $request): Response
    {
        $page    = (int)$request->query('page', 1);
        $perPage = (int)$request->query('per_page', 25);
        $filters = [
            'status'      => $request->query('status'),
            'wilaya_id'   => $request->query('wilaya_id'),
            'date_from'   => $request->query('date_from'),
            'date_to'     => $request->query('date_to'),
            'search'      => $request->query('search'),
        ];

        $result = $this->service->list($request->storeId(), $page, $perPage, $filters);
        return Response::paginated($result['data'], $result['total'], $page, $perPage);
    }

    /**
     * GET /api/v1/orders/{id}
     */
    public function show(Request $request): Response
    {
        $order = $this->service->getById((int)$request->param('id'), $request->storeId());
        if (!$order) {
            return Response::notFound('Order not found');
        }
        return Response::success($order);
    }

    /**
     * POST /api/v1/orders
     */
    public function store(Request $request): Response
    {
        $body = $request->body();
        $v = new Validator($body);
        $v->required('customer_name')->maxLength('customer_name', 100)
          ->required('customer_phone')->phone('customer_phone')
          ->phone('customer_phone_2')
          ->required('wilaya_id')->integer('wilaya_id')
          ->required('commune')->maxLength('commune', 100)
          ->required('address')->maxLength('address', 500)
          ->required('items')->array('items')
          ->numeric('shipping_cost')->min('shipping_cost', 0)
          ->numeric('discount')->min('discount', 0)
          ->maxLength('source', 50)
          ->maxLength('notes', 1000)
          ->maxLength('internal_notes', 1000);

        if ($v->fails()) {
            return Response::validationError($v->errors());
        }

        $itemErrors = $this->validateItems($body['items'] ?? null);
        if (!empty($itemErrors)) {
            return Response::validationError($itemErrors);
        }

        $mlErrors = $this->validateMlFeatures($body);
        if (!empty($mlErrors)) {
            return Response::validationError($mlErrors);
        }

        $order = $this->service->create($request->storeId(), $request->authUserId(), $body);
        return Response::created($order, 'Order created successfully');
    }

    /**
     * PUT /api/v1/orders/{id}
     */
    public function update(Request $request): Response
    {
        $body = $request->body();
        $v = new Validator($body);
        $v->maxLength('customer_name', 100)
          ->phone('customer_phone')
          ->phone('customer_phone_2')
          ->integer('wilaya_id')
          ->maxLength('commune', 100)
          ->maxLength('address', 500)
          ->numeric('shipping_cost')->min('shipping_cost', 0)
          ->numeric('discount')->min('discount', 0)
          ->maxLength('source', 50)
          ->maxLength('notes', 1000)
          ->maxLength('internal_notes', 1000);

        if (array_key_exists('items', $body)) {
            $v->array('items');
        }

        if ($v->fails()) {
            return Response::validationError($v->errors());
        }

        if (array_key_exists('items', $body)) {
            $itemErrors = $this->validateItems($body['items']);
            if (!empty($itemErrors)) {
                return Response::validationError($itemErrors);
            }
        }

        $mlErrors = $this->validateMlFeatures($body);
        if (!empty($mlErrors)) {
            return Response::validationError($mlErrors);
        }

        $order = $this->service->update(
            (int)$request->param('id'),
            $request->storeId(),
            $body
        );
        if (!$order) {
            return Response::notFound('Order not found');
        }
        return Response::success($order, 'Order updated successfully');
    }

    /**
     * PATCH /api/v1/orders/{id}/status
     */
    public function updateStatus(Request $request): Response
    {
        $v = new Validator($request->body());
        $v->required('status')->in('status', [
            'new', 'confirmed', 'processing', 'shipped', 'delivered',
            'returned', 'cancelled', 'no_answer', 'postponed'
        ]);

        if ($v->fails()) {
            return Response::validationError($v->errors());
        }

        $order = $this->service->updateStatus(
            (int)$request->param('id'),
            $request->storeId(),
            $request->body('status'),
            $request->authUserId()
        );

        if (!$order) {
            return Response::notFound('Order not found');
        }

        return Response::success($order, 'Order status updated');
    }

    /**
     * DELETE /api/v1/orders/{id}
     */
    public function destroy(Request $request): Response
    {
        $deleted = $this->service->delete((int)$request->param('id'), $request->storeId());
        if (!$deleted) {
            return Response::notFound('Order not found');
        }
        return Response::success(null, 'Order deleted successfully');
    }

    /**
     * Validate order items payload.
     */
    private function validateItems(mixed $items): array
    {
        if (!is_array($items) || empty($items)) {
            return ['items' => ['At least one item is required.']];
        }

        $errors = [];
        foreach ($items as $idx => $item) {
            if (!is_array($item)) {
                $errors["items.{$idx}"][] = 'Each item must be an object.';
                continue;
            }

            $productId = (int)($item['product_id'] ?? 0);
            $quantity = (int)($item['quantity'] ?? 0);
            $price = (float)($item['price'] ?? -1);

            if ($productId <= 0) {
                $errors["items.{$idx}.product_id"][] = 'product_id is required and must be > 0.';
            }
            if ($quantity <= 0) {
                $errors["items.{$idx}.quantity"][] = 'quantity must be > 0.';
            }
            if ($price < 0) {
                $errors["items.{$idx}.price"][] = 'price must be >= 0.';
            }
        }

        return $errors;
    }

    /**
     * Validate optional ML feature payload values.
     */
    private function validateMlFeatures(array $payload): array
    {
        $features = [];
        if (isset($payload['ml_features']) && is_array($payload['ml_features'])) {
            $features = array_merge($features, $payload['ml_features']);
        }

        $keys = [
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

        foreach ($keys as $key) {
            if (array_key_exists($key, $payload)) {
                $features[$key] = $payload[$key];
            }
        }

        if (empty($features)) {
            return [];
        }

        $errors = [];

        $numericMinZero = [
            'avg_product_weight',
            'avg_photos',
            'avg_desc_length',
            'avg_name_length',
            'avg_volume',
        ];

        foreach ($numericMinZero as $key) {
            if (array_key_exists($key, $features) && $features[$key] !== null && $features[$key] !== '') {
                if (!is_numeric($features[$key]) || (float)$features[$key] < 0) {
                    $errors[$key][] = "{$key} must be a number >= 0.";
                }
            }
        }

        if (array_key_exists('estimated_delivery_days', $features) && $features['estimated_delivery_days'] !== null && $features['estimated_delivery_days'] !== '') {
            if (!is_numeric($features['estimated_delivery_days']) || (int)$features['estimated_delivery_days'] < 1) {
                $errors['estimated_delivery_days'][] = 'estimated_delivery_days must be >= 1.';
            }
        }

        if (array_key_exists('n_sellers', $features) && $features['n_sellers'] !== null && $features['n_sellers'] !== '') {
            if (!is_numeric($features['n_sellers']) || (int)$features['n_sellers'] < 1) {
                $errors['n_sellers'][] = 'n_sellers must be >= 1.';
            }
        }

        if (array_key_exists('seller_customer_same_state', $features) && $features['seller_customer_same_state'] !== null && $features['seller_customer_same_state'] !== '') {
            $value = (int)$features['seller_customer_same_state'];
            if (!in_array($value, [0, 1], true)) {
                $errors['seller_customer_same_state'][] = 'seller_customer_same_state must be 0 or 1.';
            }
        }

        if (array_key_exists('product_category', $features) && $features['product_category'] !== null) {
            if (mb_strlen(trim((string)$features['product_category'])) > 100) {
                $errors['product_category'][] = 'product_category must not exceed 100 characters.';
            }
        }

        return $errors;
    }
}
