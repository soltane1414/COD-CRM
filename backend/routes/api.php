<?php

declare(strict_types=1);

/**
 * API Route Definitions
 *
 * All routes are prefixed with /api/v1.
 * Uses middleware groups for auth, tenant isolation, and RBAC.
 *
 * @var \App\Core\Router $router
 */

use App\Core\Middleware\AuthMiddleware;
use App\Core\Middleware\TenantMiddleware;
use App\Core\Middleware\RBACMiddleware;
use App\Modules\Auth\AuthController;
use App\Modules\Store\StoreController;
use App\Modules\User\UserController;
use App\Modules\Order\OrderController;
use App\Modules\Product\ProductController;
use App\Modules\Inventory\InventoryController;
use App\Modules\Delivery\DeliveryController;
use App\Modules\Analytics\AnalyticsController;
use App\Modules\Returns\ReturnController;
use App\Modules\Admin\AdminController;
use App\Modules\Storefront\StorefrontController;
use App\Modules\AIInsights\AIInsightsController;

// ═══════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════

$router->get('/api/health', function () {
    return \App\Core\Response::success([
        'status'  => 'ok',
        'version' => '1.0.0',
        'time'    => date('Y-m-d H:i:s'),
    ]);
});

// ═══════════════════════════════════════════════════════════
// Auth Routes (Public)
// ═══════════════════════════════════════════════════════════

$router->group('/api/v1/auth', [], function ($router) {
    $router->post('/register', [AuthController::class, 'register']);
    $router->post('/login',    [AuthController::class, 'login']);
    $router->post('/refresh',  [AuthController::class, 'refresh']);
});

// ═══════════════════════════════════════════════════════════
// Protected Routes (Authenticated + Tenant-scoped)
// ═══════════════════════════════════════════════════════════

$router->group('/api/v1', [AuthMiddleware::class, TenantMiddleware::class], function ($router) {

    // ── Auth (Protected) ──────────────────────────────────
    $router->get('/auth/me',       [AuthController::class, 'me']);
    $router->post('/auth/logout',  [AuthController::class, 'logout']);

    // ── Store ─────────────────────────────────────────────
    $router->get('/store',        [StoreController::class, 'show']);
    $router->put('/store',        [StoreController::class, 'update'],
        [new RBACMiddleware(['owner', 'admin'])]);
    $router->get('/store/stats',  [StoreController::class, 'stats']);

    // ── Users (Owner & Admin only) ────────────────────────
    $router->group('/users', [new RBACMiddleware(['owner', 'admin'])], function ($router) {
        $router->get('',          [UserController::class, 'index']);
        $router->post('',         [UserController::class, 'store']);
        $router->get('/{id}',     [UserController::class, 'show']);
        $router->put('/{id}',     [UserController::class, 'update']);
        $router->delete('/{id}',  [UserController::class, 'destroy']);
    });

    // ── Orders ────────────────────────────────────────────
    $router->get('/orders',              [OrderController::class, 'index']);
    $router->get('/orders/{id}',         [OrderController::class, 'show']);
    $router->post('/orders',             [OrderController::class, 'store'],
        [new RBACMiddleware(['owner', 'admin', 'order_confirmator'])]);
    $router->put('/orders/{id}',         [OrderController::class, 'update'],
        [new RBACMiddleware(['owner', 'admin', 'order_confirmator'])]);
    $router->patch('/orders/{id}/status', [OrderController::class, 'updateStatus'],
        [new RBACMiddleware(['owner', 'admin', 'order_confirmator', 'delivery_manager'])]);
    $router->delete('/orders/{id}',      [OrderController::class, 'destroy'],
        [new RBACMiddleware(['owner', 'admin'])]);

    // ── Products ──────────────────────────────────────────
    $router->get('/products',            [ProductController::class, 'index']);
    $router->get('/products/{id}',       [ProductController::class, 'show']);
    $router->post('/products',           [ProductController::class, 'store'],
        [new RBACMiddleware(['owner', 'admin', 'inventory_manager'])]);
    $router->put('/products/{id}',       [ProductController::class, 'update'],
        [new RBACMiddleware(['owner', 'admin', 'inventory_manager'])]);
    $router->delete('/products/{id}',    [ProductController::class, 'destroy'],
        [new RBACMiddleware(['owner', 'admin'])]);

    // ── Inventory ─────────────────────────────────────────
    $router->get('/inventory',                      [InventoryController::class, 'index']);
    $router->post('/inventory/adjust',              [InventoryController::class, 'adjust'],
        [new RBACMiddleware(['owner', 'admin', 'inventory_manager'])]);
    $router->get('/inventory/{productId}/history',  [InventoryController::class, 'history']);
    $router->get('/inventory/alerts',               [InventoryController::class, 'alerts']);

    // ── Deliveries ────────────────────────────────────────
    $router->get('/deliveries',              [DeliveryController::class, 'index']);
    $router->get('/deliveries/{id}',         [DeliveryController::class, 'show']);
    $router->post('/deliveries',             [DeliveryController::class, 'store'],
        [new RBACMiddleware(['owner', 'admin', 'delivery_manager'])]);
    $router->patch('/deliveries/{id}/status', [DeliveryController::class, 'updateStatus'],
        [new RBACMiddleware(['owner', 'admin', 'delivery_manager'])]);

    // ── Returns ───────────────────────────────────────────
    $router->get('/returns',              [ReturnController::class, 'index']);
    $router->get('/returns/{id}',         [ReturnController::class, 'show']);
    $router->post('/returns',             [ReturnController::class, 'store'],
        [new RBACMiddleware(['owner', 'admin', 'delivery_manager'])]);
    $router->patch('/returns/{id}/status', [ReturnController::class, 'updateStatus'],
        [new RBACMiddleware(['owner', 'admin', 'delivery_manager'])]);

    // ── Analytics (read-only for accountant) ──────────────
    $router->group('/analytics', [], function ($router) {
        $router->get('/dashboard', [AnalyticsController::class, 'dashboard']);
        $router->get('/orders',    [AnalyticsController::class, 'orders']);
        $router->get('/wilayas',   [AnalyticsController::class, 'wilayas']);
        $router->get('/products',  [AnalyticsController::class, 'products']);
        $router->get('/returns',   [AnalyticsController::class, 'returns']);
        $router->get('/revenue',   [AnalyticsController::class, 'revenue']);
    });

    // ── AI Insights (Owner, Admin, Accountant) ──────────────
    $router->group('/ai', [new RBACMiddleware(['owner', 'admin', 'accountant'])], function ($router) {
        $router->get('/health',           [AIInsightsController::class, 'health']);
        $router->get('/order-risk/{id}',  [AIInsightsController::class, 'orderRisk']);
        $router->get('/segments',         [AIInsightsController::class, 'segments']);
        $router->get('/forecast',         [AIInsightsController::class, 'forecast']);
        $router->get('/insights',         [AIInsightsController::class, 'insights']);
        $router->get('/recommendations',  [AIInsightsController::class, 'recommendations']);
        $router->post('/retrain',         [AIInsightsController::class, 'retrainFromDatabase'],
            [new RBACMiddleware(['owner', 'admin'])]);
    });
});

// ═══════════════════════════════════════════════════════════
// Super Admin Routes (Platform-level, no tenant scope)
// ═══════════════════════════════════════════════════════════

$router->group('/api/v1/admin', [], function ($router) {
    // Public — super admin login
    $router->post('/login', [AdminController::class, 'login']);

    // Protected — handled internally by AdminController::requireSuperAdmin()
    $router->get('/me',                    [AdminController::class, 'me']);
    $router->get('/stats',                 [AdminController::class, 'stats']);
    $router->get('/stores',                [AdminController::class, 'stores']);
    $router->patch('/stores/{id}/status',  [AdminController::class, 'toggleStoreStatus']);
    $router->get('/users',                 [AdminController::class, 'users']);
});

// ═══════════════════════════════════════════════════════════
// Storefront Routes (Public — no auth needed)
// ═══════════════════════════════════════════════════════════

$router->group('/api/v1/storefront', [], function ($router) {
    $router->get('/{slug}',           [StorefrontController::class, 'storeInfo']);
    $router->get('/{slug}/products',  [StorefrontController::class, 'products']);
    $router->post('/{slug}/orders',   [StorefrontController::class, 'placeOrder']);
});
