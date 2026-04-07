-- ============================================================
-- COD CRM — Database Migration: Order Tables
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ──────────────────────────────────────────────────────────
-- 7. Orders (tenant-scoped) — COD workflow
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `orders` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `store_id`        INT UNSIGNED NOT NULL,
    `reference`       VARCHAR(30) NOT NULL,
    `customer_name`   VARCHAR(100) NOT NULL,
    `customer_phone`  VARCHAR(20) NOT NULL,
    `customer_phone_2` VARCHAR(20) DEFAULT NULL,
    `wilaya_id`       INT UNSIGNED DEFAULT NULL,
    `commune`         VARCHAR(100) DEFAULT NULL,
    `address`         VARCHAR(500) DEFAULT NULL,
    `subtotal`        DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `shipping_cost`   DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `discount`        DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_amount`    DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `status`          ENUM('new', 'confirmed', 'processing', 'shipped', 'delivered', 'returned', 'cancelled', 'no_answer', 'postponed') NOT NULL DEFAULT 'new',
    `attempt_count`   TINYINT UNSIGNED DEFAULT 0,
    `notes`           TEXT DEFAULT NULL,
    `internal_notes`  TEXT DEFAULT NULL,
    `source`          VARCHAR(50) DEFAULT 'manual',
    `ml_features`     JSON DEFAULT NULL,
    `created_by`      INT UNSIGNED DEFAULT NULL,
    `confirmed_by`    INT UNSIGNED DEFAULT NULL,
    `confirmed_at`    DATETIME DEFAULT NULL,
    `shipped_at`      DATETIME DEFAULT NULL,
    `delivered_at`    DATETIME DEFAULT NULL,
    `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `idx_orders_store_ref` (`store_id`, `reference`),
    INDEX `idx_orders_store_status` (`store_id`, `status`),
    INDEX `idx_orders_store_wilaya` (`store_id`, `wilaya_id`),
    INDEX `idx_orders_store_created` (`store_id`, `created_at`),
    INDEX `idx_orders_customer_phone` (`store_id`, `customer_phone`),
    CONSTRAINT `fk_orders_store` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_orders_wilaya` FOREIGN KEY (`wilaya_id`) REFERENCES `wilayas`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_orders_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_orders_confirmed_by` FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
-- 8. Order Items
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_items` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id`    INT UNSIGNED NOT NULL,
    `product_id`  INT UNSIGNED DEFAULT NULL,
    `product_name` VARCHAR(200) DEFAULT NULL,
    `quantity`    INT NOT NULL DEFAULT 1,
    `price`       DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total`       DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (`id`),
    INDEX `idx_order_items_order` (`order_id`),
    INDEX `idx_order_items_product` (`product_id`),
    CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
-- 9. Order Status History (audit trail)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_status_history` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id`    INT UNSIGNED NOT NULL,
    `status`      VARCHAR(30) NOT NULL,
    `note`        VARCHAR(500) DEFAULT NULL,
    `changed_by`  INT UNSIGNED DEFAULT NULL,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_status_history_order` (`order_id`),
    INDEX `idx_status_history_created` (`created_at`),
    CONSTRAINT `fk_status_history_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_status_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
