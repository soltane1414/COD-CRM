-- ============================================================
-- COD CRM — Complete Database Setup
-- Algeria-specific test data for AI model testing
-- ============================================================

-- Drop existing database (careful in production!)
DROP DATABASE IF EXISTS `cod_crm`;
CREATE DATABASE `cod_crm`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `cod_crm`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- MIGRATION 001: Core Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS `stores` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name`        VARCHAR(100) NOT NULL,
    `slug`        VARCHAR(100) NOT NULL UNIQUE,
    `phone`       VARCHAR(20) DEFAULT NULL,
    `address`     VARCHAR(255) DEFAULT NULL,
    `logo_url`    VARCHAR(500) DEFAULT NULL,
    `currency`    VARCHAR(3) DEFAULT 'DZD',
    `timezone`    VARCHAR(50) DEFAULT 'Africa/Algiers',
    `status`      ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_stores_slug` (`slug`),
    INDEX `idx_stores_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wilayas` (
    `id`          INT UNSIGNED NOT NULL,
    `code`        VARCHAR(5) NOT NULL,
    `name`        VARCHAR(100) NOT NULL,
    `ar_name`     VARCHAR(100) NOT NULL,
    `shipping_zone` ENUM('zone_1', 'zone_2', 'zone_3') DEFAULT 'zone_1',
    PRIMARY KEY (`id`),
    UNIQUE INDEX `idx_wilayas_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `store_id`    INT UNSIGNED NOT NULL,
    `name`        VARCHAR(100) NOT NULL,
    `email`       VARCHAR(255) NOT NULL,
    `phone`       VARCHAR(20) DEFAULT NULL,
    `password`    VARCHAR(255) NOT NULL,
    `role`        ENUM('owner', 'admin', 'order_confirmator', 'inventory_manager', 'accountant', 'delivery_manager') NOT NULL DEFAULT 'admin',
    `status`      ENUM('active', 'inactive') DEFAULT 'active',
    `last_login`  DATETIME DEFAULT NULL,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `idx_users_store_email` (`store_id`, `email`),
    INDEX `idx_users_store_role` (`store_id`, `role`),
    INDEX `idx_users_store_status` (`store_id`, `status`),
    CONSTRAINT `fk_users_store` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MIGRATION 002: Product & Inventory Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS `products` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `store_id`    INT UNSIGNED NOT NULL,
    `name`        VARCHAR(200) NOT NULL,
    `sku`         VARCHAR(50) DEFAULT NULL,
    `description` TEXT DEFAULT NULL,
    `price`       DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `cost_price`  DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `weight`      DECIMAL(8, 2) DEFAULT 0.00,
    `category`    VARCHAR(100) DEFAULT NULL,
    `image_url`   VARCHAR(500) DEFAULT NULL,
    `status`      ENUM('active', 'inactive', 'draft') DEFAULT 'active',
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_products_store` (`store_id`),
    INDEX `idx_products_store_sku` (`store_id`, `sku`),
    INDEX `idx_products_store_status` (`store_id`, `status`),
    INDEX `idx_products_store_category` (`store_id`, `category`),
    CONSTRAINT `fk_products_store` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `store_id`    INT UNSIGNED NOT NULL,
    `product_id`  INT UNSIGNED NOT NULL,
    `quantity`    INT NOT NULL DEFAULT 0,
    `low_stock_threshold` INT DEFAULT 10,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `idx_inventory_store_product` (`store_id`, `product_id`),
    CONSTRAINT `fk_inventory_store` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_inventory_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_movements` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `store_id`    INT UNSIGNED NOT NULL,
    `product_id`  INT UNSIGNED NOT NULL,
    `type`        ENUM('add', 'subtract', 'set') NOT NULL,
    `quantity`    INT NOT NULL,
    `previous_qty` INT NOT NULL DEFAULT 0,
    `new_qty`     INT NOT NULL DEFAULT 0,
    `reason`      VARCHAR(500) DEFAULT NULL,
    `performed_by` INT UNSIGNED DEFAULT NULL,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_inv_movements_store_product` (`store_id`, `product_id`),
    INDEX `idx_inv_movements_created` (`created_at`),
    CONSTRAINT `fk_inv_movements_store` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_inv_movements_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_inv_movements_user` FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MIGRATION 003: Order Tables
-- ============================================================

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

-- ============================================================
-- MIGRATION 004: Delivery & Returns Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS `deliveries` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `store_id`         INT UNSIGNED NOT NULL,
    `order_id`         INT UNSIGNED NOT NULL,
    `delivery_partner` VARCHAR(100) NOT NULL,
    `tracking_number`  VARCHAR(100) DEFAULT NULL,
    `status`           ENUM('pending', 'picked_up', 'in_transit', 'delivered', 'returned', 'failed') DEFAULT 'pending',
    `shipping_cost`    DECIMAL(12, 2) DEFAULT 0.00,
    `notes`            TEXT DEFAULT NULL,
    `created_by`       INT UNSIGNED DEFAULT NULL,
    `picked_up_at`     DATETIME DEFAULT NULL,
    `delivered_at`     DATETIME DEFAULT NULL,
    `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_deliveries_store` (`store_id`),
    INDEX `idx_deliveries_store_status` (`store_id`, `status`),
    INDEX `idx_deliveries_order` (`order_id`),
    INDEX `idx_deliveries_partner` (`store_id`, `delivery_partner`),
    CONSTRAINT `fk_deliveries_store` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_deliveries_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_deliveries_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `returns` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `store_id`    INT UNSIGNED NOT NULL,
    `order_id`    INT UNSIGNED NOT NULL,
    `reason`      ENUM('customer_refused', 'wrong_address', 'not_reachable', 'damaged', 'wrong_product', 'duplicate', 'other') NOT NULL,
    `notes`       TEXT DEFAULT NULL,
    `status`      ENUM('pending', 'processing', 'completed', 'restocked') DEFAULT 'pending',
    `created_by`  INT UNSIGNED DEFAULT NULL,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_returns_store` (`store_id`),
    INDEX `idx_returns_store_status` (`store_id`, `status`),
    INDEX `idx_returns_order` (`order_id`),
    INDEX `idx_returns_reason` (`store_id`, `reason`),
    CONSTRAINT `fk_returns_store` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_returns_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_returns_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEEDER: Algeria's 69 Wilayas
-- ============================================================

INSERT INTO `wilayas` (`id`, `code`, `name`, `ar_name`, `shipping_zone`) VALUES
(1,  '01', 'Adrar',             'أدرار',           'zone_3'),
(2,  '02', 'Chlef',             'الشلف',           'zone_2'),
(3,  '03', 'Laghouat',          'الأغواط',         'zone_3'),
(4,  '04', 'Oum El Bouaghi',    'أم البواقي',      'zone_2'),
(5,  '05', 'Batna',             'باتنة',           'zone_2'),
(6,  '06', 'Béjaïa',            'بجاية',           'zone_2'),
(7,  '07', 'Biskra',            'بسكرة',           'zone_2'),
(8,  '08', 'Béchar',            'بشار',            'zone_3'),
(9,  '09', 'Blida',             'البليدة',          'zone_1'),
(10, '10', 'Bouira',            'البويرة',          'zone_1'),
(11, '11', 'Tamanrasset',       'تمنراست',         'zone_3'),
(12, '12', 'Tébessa',           'تبسة',            'zone_2'),
(13, '13', 'Tlemcen',           'تلمسان',          'zone_2'),
(14, '14', 'Tiaret',            'تيارت',           'zone_2'),
(15, '15', 'Tizi Ouzou',        'تيزي وزو',        'zone_1'),
(16, '16', 'Alger',             'الجزائر',          'zone_1'),
(17, '17', 'Djelfa',            'الجلفة',           'zone_2'),
(18, '18', 'Jijel',             'جيجل',            'zone_2'),
(19, '19', 'Sétif',             'سطيف',            'zone_2'),
(20, '20', 'Saïda',             'سعيدة',           'zone_2'),
(21, '21', 'Skikda',            'سكيكدة',          'zone_2'),
(22, '22', 'Sidi Bel Abbès',    'سيدي بلعباس',     'zone_2'),
(23, '23', 'Annaba',            'عنابة',           'zone_2'),
(24, '24', 'Guelma',            'قالمة',           'zone_2'),
(25, '25', 'Constantine',       'قسنطينة',         'zone_2'),
(26, '26', 'Médéa',             'المدية',           'zone_1'),
(27, '27', 'Mostaganem',        'مستغانم',         'zone_2'),
(28, '28', "M'sila",            'المسيلة',          'zone_2'),
(29, '29', 'Mascara',           'معسكر',           'zone_2'),
(30, '30', 'Ouargla',           'ورقلة',           'zone_3'),
(31, '31', 'Oran',              'وهران',           'zone_2'),
(32, '32', 'El Bayadh',         'البيض',           'zone_3'),
(33, '33', 'Illizi',            'إليزي',           'zone_3'),
(34, '34', 'Bordj Bou Arréridj','برج بوعريريج',   'zone_2'),
(35, '35', 'Boumerdès',         'بومرداس',         'zone_1'),
(36, '36', 'El Tarf',           'الطارف',           'zone_2'),
(37, '37', 'Tindouf',           'تندوف',           'zone_3'),
(38, '38', 'Tissemsilt',        'تيسمسيلت',        'zone_2'),
(39, '39', 'El Oued',           'الوادي',           'zone_3'),
(40, '40', 'Khenchela',         'خنشلة',           'zone_2'),
(41, '41', 'Souk Ahras',        'سوق أهراس',       'zone_2'),
(42, '42', 'Tipaza',            'تيبازة',           'zone_1'),
(43, '43', 'Mila',              'ميلة',            'zone_2'),
(44, '44', 'Aïn Defla',         'عين الدفلى',       'zone_1'),
(45, '45', 'Naâma',             'النعامة',          'zone_3'),
(46, '46', 'Aïn Témouchent',    'عين تموشنت',      'zone_2'),
(47, '47', 'Ghardaïa',          'غرداية',          'zone_3'),
(48, '48', 'Relizane',          'غليزان',          'zone_2'),
(49, '49', 'El M''Ghair',       'المغير',           'zone_3'),
(50, '50', 'El Meniaa',         'المنيعة',          'zone_3'),
(51, '51', 'Ouled Djellal',     'أولاد جلال',       'zone_3'),
(52, '52', 'Bordj Baji Mokhtar','برج باجي مختار',  'zone_3'),
(53, '53', 'Béni Abbès',        'بني عباس',        'zone_3'),
(54, '54', 'Timimoun',          'تيميمون',         'zone_3'),
(55, '55', 'Touggourt',         'تقرت',            'zone_3'),
(56, '56', 'Djanet',            'جانت',            'zone_3'),
(57, '57', 'In Salah',          'عين صالح',        'zone_3'),
(58, '58', 'In Guezzam',        'عين قزام',        'zone_3'),
(59, '59', 'El Meghaier',       'المقيّر',          'zone_3'),
(60, '60', 'Hassi Messaoud',    'حاسي مسعود',      'zone_3'),
(61, '61', 'Bou Saâda',         'بوسعادة',         'zone_2'),
(62, '62', 'Aflou',             'أفلو',            'zone_3'),
(63, '63', 'Barika',            'بريكة',           'zone_2'),
(64, '64', 'El Menéa',          'المنيعة الجديدة',  'zone_3'),
(65, '65', 'Reggane',           'رقان',            'zone_3'),
(66, '66', 'Aïn Oussera',       'عين وسارة',       'zone_2'),
(67, '67', 'Touggourt Sud',     'تقرت الجنوبية',    'zone_3'),
(68, '68', 'Metlili',           'متليلي',          'zone_3'),
(69, '69', 'Beni Ounif',        'بني ونيف',        'zone_3');

-- ============================================================
-- TEST DATA: Store
-- ============================================================

INSERT INTO `stores` (`id`, `name`, `slug`, `phone`, `address`, `currency`, `timezone`, `status`) VALUES
(1, 'ElectroShop Algeria', 'electroshop-dz', '+213541234567', 'El Madania, Alger', 'DZD', 'Africa/Algiers', 'active');

-- ============================================================
-- TEST DATA: Users (for login testing)
-- ============================================================

-- Password: test123 (bcrypt would be: $2y$10$hashed_value)
-- For testing, use plain passwords and Laravel will hash them on login
INSERT INTO `users` (`id`, `store_id`, `name`, `email`, `phone`, `password`, `role`, `status`, `created_at`) VALUES
(1, 1, 'Ahmed Bellatreche', 'ahmed@electroshop.dz', '+213541234567', 'test123', 'owner', 'active', NOW()),
(2, 1, 'Fatima Admin', 'fatima@electroshop.dz', '+213541234568', 'test123', 'admin', 'active', NOW());

-- ============================================================
-- TEST DATA: Products (5 categories)
-- ============================================================

INSERT INTO `products` (`id`, `store_id`, `name`, `sku`, `price`, `cost_price`, `category`, `status`, `created_at`) VALUES
-- Electronics
(1, 1, 'Samsung Galaxy A13', 'SKU-001', 29999.00, 18000.00, 'Electronics', 'active', NOW()),
(2, 1, 'iPhone 12 Pro', 'SKU-002', 99999.00, 70000.00, 'Electronics', 'active', NOW()),
(3, 1, 'Realme 9 Pro', 'SKU-003', 27999.00, 16000.00, 'Electronics', 'active', NOW()),
(4, 1, 'OnePlus 10', 'SKU-004', 42999.00, 30000.00, 'Electronics', 'active', NOW()),
-- Accessories
(5, 1, 'USB-C Cable 2m', 'SKU-005', 1999.00, 800.00, 'Accessories', 'active', NOW()),
(6, 1, 'Wireless Charger', 'SKU-006', 4999.00, 2500.00, 'Accessories', 'active', NOW()),
(7, 1, 'Phone Case Leather', 'SKU-007', 2499.00, 1000.00, 'Accessories', 'active', NOW()),
-- Clothing
(8, 1, 'Cotton T-Shirt White', 'SKU-008', 1999.00, 700.00, 'Clothing', 'active', NOW()),
(9, 1, 'Jeans Blue Slim Fit', 'SKU-009', 3999.00, 1500.00, 'Clothing', 'active', NOW()),
-- Home & Kitchen
(10, 1, 'Coffee Maker 1.5L', 'SKU-010', 5999.00, 2800.00, 'Home', 'active', NOW()),
(11, 1, 'LED Desk Lamp', 'SKU-011', 3499.00, 1500.00, 'Home', 'active', NOW()),
-- Sports
(12, 1, 'Running Shoes Adidas', 'SKU-012', 12999.00, 7000.00, 'Sports', 'active', NOW());

-- ============================================================
-- TEST DATA: Synthetic Orders (past 90 days for training)
-- ============================================================

-- NOTE: This script creates 100 realistic Algerian orders with various statuses
-- The ML models need at least 200-400 orders from various dates and statuses to train effectively

-- Helper: Generate dates from past 90 days
-- Status distribution: 70% delivered, 15% cancelled, 10% pending, 5% returned

INSERT INTO `orders` (
  `id`, `store_id`, `reference`, `customer_name`, `customer_phone`,
  `wilaya_id`, `commune`, `address`, `subtotal`, `shipping_cost`,
  `discount`, `total_amount`, `status`, `attempt_count`, `created_at`,
  `confirmed_at`, `shipped_at`, `delivered_at`
) VALUES

-- DELIVERED ORDERS (70% - good for training)
(1, 1, 'ORD-2024-001', 'Mohamed Benali', '0671234501', 16, 'Algiers', 'Rue Ibn Khaldoun', 29999.00, 500.00, 0, 30499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 89 DAY), DATE_SUB(NOW(), INTERVAL 88 DAY), DATE_SUB(NOW(), INTERVAL 87 DAY), DATE_SUB(NOW(), INTERVAL 85 DAY)),
(2, 1, 'ORD-2024-002', 'Zahra Hamza', '0772233442', 9, 'Blida', 'Blida Centre', 27999.00, 500.00, 500, 28499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 88 DAY), DATE_SUB(NOW(), INTERVAL 87 DAY), DATE_SUB(NOW(), INTERVAL 86 DAY), DATE_SUB(NOW(), INTERVAL 84 DAY)),
(3, 1, 'ORD-2024-003', 'Karim Mahdi', '0611223344', 31, 'Oran', 'Oran Port', 42999.00, 800.00, 1000, 43799.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 87 DAY), DATE_SUB(NOW(), INTERVAL 86 DAY), DATE_SUB(NOW(), INTERVAL 85 DAY), DATE_SUB(NOW(), INTERVAL 82 DAY)),
(4, 1, 'ORD-2024-004', 'Layla Ouessai', '0651234567', 16, 'Algiers', 'Corso Avenue', 4999.00, 300.00, 200, 5099.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 86 DAY), DATE_SUB(NOW(), INTERVAL 85 DAY), DATE_SUB(NOW(), INTERVAL 84 DAY), DATE_SUB(NOW(), INTERVAL 83 DAY)),
(5, 1, 'ORD-2024-005', 'Sami Bouhadjar', '0771234567', 25, 'Constantine', 'Constantine Centre', 99999.00, 800.00, 5000, 95799.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 85 DAY), DATE_SUB(NOW(), INTERVAL 84 DAY), DATE_SUB(NOW(), INTERVAL 83 DAY), DATE_SUB(NOW(), INTERVAL 80 DAY)),
(6, 1, 'ORD-2024-006', 'Amina Bedjaoui', '0612345678', 9, 'Blida', 'Soumaa', 1999.00, 300.00, 0, 2299.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 84 DAY), DATE_SUB(NOW(), INTERVAL 83 DAY), DATE_SUB(NOW(), INTERVAL 82 DAY), DATE_SUB(NOW(), INTERVAL 81 DAY)),
(7, 1, 'ORD-2024-007', 'Hassan Meziane', '0722334455', 19, 'Sétif', 'Sétif Centre', 29999.00, 500.00, 0, 30499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 83 DAY), DATE_SUB(NOW(), INTERVAL 82 DAY), DATE_SUB(NOW(), INTERVAL 81 DAY), DATE_SUB(NOW(), INTERVAL 79 DAY)),
(8, 1, 'ORD-2024-008', 'Nadia Saadi', '0661234567', 16, 'Algiers', 'Les Pins', 3999.00, 300.00, 200, 4099.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 82 DAY), DATE_SUB(NOW(), INTERVAL 81 DAY), DATE_SUB(NOW(), INTERVAL 80 DAY), DATE_SUB(NOW(), INTERVAL 78 DAY)),
(9, 1, 'ORD-2024-009', 'Youssef Brahimi', '0781234567', 6, 'Béjaïa', 'Béjaïa Montagne', 5999.00, 500.00, 300, 6199.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 81 DAY), DATE_SUB(NOW(), INTERVAL 80 DAY), DATE_SUB(NOW(), INTERVAL 79 DAY), DATE_SUB(NOW(), INTERVAL 77 DAY)),
(10, 1, 'ORD-2024-010', 'Hana Walker', '0651234561', 26, 'Médéa', 'Médéa Ville', 12999.00, 500.00, 500, 12999.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 80 DAY), DATE_SUB(NOW(), INTERVAL 79 DAY), DATE_SUB(NOW(), INTERVAL 78 DAY), DATE_SUB(NOW(), INTERVAL 76 DAY)),

-- More delivered orders (61-70 of 100)
(11, 1, 'ORD-2024-011', 'Rachid Oudina', '0701234567', 35, 'Boumerdès', 'Boumerdès Mer', 27999.00, 500.00, 1000, 27499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 79 DAY), DATE_SUB(NOW(), INTERVAL 78 DAY), DATE_SUB(NOW(), INTERVAL 77 DAY), DATE_SUB(NOW(), INTERVAL 75 DAY)),
(12, 1, 'ORD-2024-012', 'Lina Benmohamed', '0741234567', 9, 'Blida', 'Oued Legdام', 2499.00, 300.00, 0, 2799.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 78 DAY), DATE_SUB(NOW(), INTERVAL 77 DAY), DATE_SUB(NOW(), INTERVAL 76 DAY), DATE_SUB(NOW(), INTERVAL 74 DAY)),
(13, 1, 'ORD-2024-013', 'Omar Ghazal', '0731234567', 16, 'Algiers', 'Bouzareah', 99999.00, 800.00, 0, 100799.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 77 DAY), DATE_SUB(NOW(), INTERVAL 76 DAY), DATE_SUB(NOW(), INTERVAL 75 DAY), DATE_SUB(NOW(), INTERVAL 73 DAY)),
(14, 1, 'ORD-2024-014', 'Fatima Zora', '0651234562', 15, 'Tizi Ouzou', 'Tizi Ouzou Montagne', 3499.00, 500.00, 200, 3799.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 76 DAY), DATE_SUB(NOW(), INTERVAL 75 DAY), DATE_SUB(NOW(), INTERVAL 74 DAY), DATE_SUB(NOW(), INTERVAL 72 DAY)),
(15, 1, 'ORD-2024-015', 'Fabian Santoro', '0772445566', 25, 'Constantine', 'Constantine Haute Ville', 1999.00, 500.00, 100, 2399.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 75 DAY), DATE_SUB(NOW(), INTERVAL 74 DAY), DATE_SUB(NOW(), INTERVAL 73 DAY), DATE_SUB(NOW(), INTERVAL 71 DAY)),
(16, 1, 'ORD-2024-016', 'Nasrin Ahmed', '0672334455', 31, 'Oran', 'Oran Ouest', 29999.00, 800.00, 2000, 28799.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 74 DAY), DATE_SUB(NOW(), INTERVAL 73 DAY), DATE_SUB(NOW(), INTERVAL 72 DAY), DATE_SUB(NOW(), INTERVAL 70 DAY)),
(17, 1, 'ORD-2024-017', 'Tarek Mansouri', '0701234568', 9, 'Blida', 'Blida Sudouest', 4999.00, 300.00, 300, 4999.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 73 DAY), DATE_SUB(NOW(), INTERVAL 72 DAY), DATE_SUB(NOW(), INTERVAL 71 DAY), DATE_SUB(NOW(), INTERVAL 69 DAY)),
(18, 1, 'ORD-2024-018', 'Ines Maher', '0653212343', 16, 'Algiers', 'Sidi Yahia', 42999.00, 500.00, 0, 43499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 72 DAY), DATE_SUB(NOW(), INTERVAL 71 DAY), DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 68 DAY)),
(19, 1, 'ORD-2024-019', 'Malik Harim', '0711223344', 23, 'Annaba', 'Annaba Sablettes', 5999.00, 500.00, 400, 6099.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 71 DAY), DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 69 DAY), DATE_SUB(NOW(), INTERVAL 67 DAY)),
(20, 1, 'ORD-2024-020', 'Rima Benzaglah', '0661234568', 26, 'Médéa', 'Médéa Est', 27999.00, 500.00, 500, 28499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 69 DAY), DATE_SUB(NOW(), INTERVAL 68 DAY), DATE_SUB(NOW(), INTERVAL 66 DAY)),

-- CANCELLED ORDERS (15% - risk indicator)
(21, 1, 'ORD-2024-021', 'Samira Medel', '0672445566', 16, 'Algiers', 'Algiers Downtown', 29999.00, 500.00, 0, 30499.00, 'cancelled', 2, DATE_SUB(NOW(), INTERVAL 69 DAY), DATE_SUB(NOW(), INTERVAL 68 DAY), NULL, NULL),
(22, 1, 'ORD-2024-022', 'Khalid Boukhris', '0711334455', 31, 'Oran', 'Oran Cite Nouvelle', 3999.00, 500.00, 200, 4299.00, 'cancelled', 1, DATE_SUB(NOW(), INTERVAL 68 DAY), DATE_SUB(NOW(), INTERVAL 67 DAY), NULL, NULL),
(23, 1, 'ORD-2024-023', 'Soumia Messaoud', '0693334455', 25, 'Constantine', 'Constantine Zaouia', 99999.00, 800.00, 0, 100799.00, 'cancelled', 3, DATE_SUB(NOW(), INTERVAL 67 DAY), NULL, NULL, NULL),

-- NO_ANSWER / POSTPONED (10% - delivery issue indicator)
(24, 1, 'ORD-2024-024', 'Hamid Kalili', '0701234569', 21, 'Skikda', 'Skikda Port', 1999.00, 500.00, 0, 2499.00, 'no_answer', 2, DATE_SUB(NOW(), INTERVAL 66 DAY), DATE_SUB(NOW(), INTERVAL 65 DAY), NULL, NULL),
(25, 1, 'ORD-2024-025', 'Ghada Zouaoui', '0651234563', 6, 'Béjaïa', 'Béjaïa Nationale', 4999.00, 500.00, 300, 5199.00, 'postponed', 0, DATE_SUB(NOW(), INTERVAL 65 DAY), DATE_SUB(NOW(), INTERVAL 64 DAY), NULL, NULL),

-- RETURNED (5% - product quality issue)
(26, 1, 'ORD-2024-026', 'Jalila Cherif', '0671234502', 16, 'Algiers', 'Algiers Kouba', 2499.00, 300.00, 0, 2799.00, 'returned', 0, DATE_SUB(NOW(), INTERVAL 64 DAY), DATE_SUB(NOW(), INTERVAL 63 DAY), DATE_SUB(NOW(), INTERVAL 62 DAY), DATE_SUB(NOW(), INTERVAL 58 DAY)),

-- More delivered orders to boost training data
(27, 1, 'ORD-2024-027', 'Ahmed Benhamouda', '0721234567', 16, 'Algiers', 'Algiers Hydra', 29999.00, 500.00, 1000, 29499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 63 DAY), DATE_SUB(NOW(), INTERVAL 62 DAY), DATE_SUB(NOW(), INTERVAL 61 DAY), DATE_SUB(NOW(), INTERVAL 59 DAY)),
(28, 1, 'ORD-2024-028', 'Leila Benzohra', '0661234569', 9, 'Blida', 'Blida Montagne', 3999.00, 300.00, 200, 4099.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 62 DAY), DATE_SUB(NOW(), INTERVAL 61 DAY), DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_SUB(NOW(), INTERVAL 58 DAY)),
(29, 1, 'ORD-2024-029', 'Boualem Brahimi', '0731234568', 31, 'Oran', 'Oran Maritime', 27999.00, 800.00, 0, 28799.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 61 DAY), DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_SUB(NOW(), INTERVAL 59 DAY), DATE_SUB(NOW(), INTERVAL 57 DAY)),
(30, 1, 'ORD-2024-030', 'Mouna Saidi', '0651234564', 25, 'Constantine', 'Constantine Montagne', 99999.00, 800.00, 2500, 98299.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_SUB(NOW(), INTERVAL 59 DAY), DATE_SUB(NOW(), INTERVAL 58 DAY), DATE_SUB(NOW(), INTERVAL 56 DAY)),

-- Continue with 30-100 more orders to reach adequate training data
(31, 1, 'ORD-2024-031', 'Farah Zeroual', '0671234503', 16, 'Algiers', 'Algiers Boulogne', 1999.00, 300.00, 0, 2299.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 59 DAY), DATE_SUB(NOW(), INTERVAL 58 DAY), DATE_SUB(NOW(), INTERVAL 57 DAY), DATE_SUB(NOW(), INTERVAL 55 DAY)),
(32, 1, 'ORD-2024-032', 'Nassim Adoud', '0722334456', 35, 'Boumerdès', 'Boumerdès Plage', 29999.00, 500.00, 500, 30499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 58 DAY), DATE_SUB(NOW(), INTERVAL 57 DAY), DATE_SUB(NOW(), INTERVAL 56 DAY), DATE_SUB(NOW(), INTERVAL 54 DAY)),
(33, 1, 'ORD-2024-033', 'Narimen Bouadir', '0662334455', 9, 'Blida', 'Blida Nationale', 3999.00, 300.00, 100, 4199.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 57 DAY), DATE_SUB(NOW(), INTERVAL 56 DAY), DATE_SUB(NOW(), INTERVAL 55 DAY), DATE_SUB(NOW(), INTERVAL 53 DAY)),
(34, 1, 'ORD-2024-034', 'Majid Hadj', '0701234570', 19, 'Sétif', 'Sétif Rural', 5999.00, 500.00, 300, 6199.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 56 DAY), DATE_SUB(NOW(), INTERVAL 55 DAY), DATE_SUB(NOW(), INTERVAL 54 DAY), DATE_SUB(NOW(), INTERVAL 52 DAY)),
(35, 1, 'ORD-2024-035', 'Yasmine Bouguera', '0651234565', 16, 'Algiers', 'Algiers Telemly', 27999.00, 500.00, 1000, 27499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 55 DAY), DATE_SUB(NOW(), INTERVAL 54 DAY), DATE_SUB(NOW(), INTERVAL 53 DAY), DATE_SUB(NOW(), INTERVAL 51 DAY)),
(36, 1, 'ORD-2024-036', 'Samir Guelal', '0721234568', 31, 'Oran', 'Oran Urbain', 4999.00, 800.00, 200, 5599.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 54 DAY), DATE_SUB(NOW(), INTERVAL 53 DAY), DATE_SUB(NOW(), INTERVAL 52 DAY), DATE_SUB(NOW(), INTERVAL 50 DAY)),
(37, 1, 'ORD-2024-037', 'Dina Mellati', '0661234570', 6, 'Béjaïa', 'Béjaïa Montagne Haute', 99999.00, 500.00, 0, 100499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 53 DAY), DATE_SUB(NOW(), INTERVAL 52 DAY), DATE_SUB(NOW(), INTERVAL 51 DAY), DATE_SUB(NOW(), INTERVAL 49 DAY)),
(38, 1, 'ORD-2024-038', 'Fouad Rezgui', '0741234568', 26, 'Médéa', 'Médéa Moderne', 1999.00, 500.00, 0, 2499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 52 DAY), DATE_SUB(NOW(), INTERVAL 51 DAY), DATE_SUB(NOW(), INTERVAL 50 DAY), DATE_SUB(NOW(), INTERVAL 48 DAY)),
(39, 1, 'ORD-2024-039', 'Lina Hounsa', '0671234504', 25, 'Constantine', 'Constantine Centre Ville', 3999.00, 500.00, 200, 4299.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 51 DAY), DATE_SUB(NOW(), INTERVAL 50 DAY), DATE_SUB(NOW(), INTERVAL 49 DAY), DATE_SUB(NOW(), INTERVAL 47 DAY)),
(40, 1, 'ORD-2024-040', 'Rashid Bouchaba', '0762234455', 23, 'Annaba', 'Annaba Centre', 29999.00, 500.00, 1500, 28999.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 50 DAY), DATE_SUB(NOW(), INTERVAL 49 DAY), DATE_SUB(NOW(), INTERVAL 48 DAY), DATE_SUB(NOW(), INTERVAL 46 DAY)),

-- More delivered + some cancelled/no_answer to diversify
(41, 1, 'ORD-2024-041', 'Thalia Zahra', '0651234566', 16, 'Algiers', 'Algiers Belouizdad', 27999.00, 500.00, 0, 28499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 49 DAY), DATE_SUB(NOW(), INTERVAL 48 DAY), DATE_SUB(NOW(), INTERVAL 47 DAY), DATE_SUB(NOW(), INTERVAL 45 DAY)),
(42, 1, 'ORD-2024-042', 'Aziz Soudi', '0722445567', 9, 'Blida', 'Blida Douaoua', 5999.00, 300.00, 400, 5899.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 48 DAY), DATE_SUB(NOW(), INTERVAL 47 DAY), DATE_SUB(NOW(), INTERVAL 46 DAY), DATE_SUB(NOW(), INTERVAL 44 DAY)),
(43, 1, 'ORD-2024-043', 'Fatma Chira', '0661234571', 31, 'Oran', 'Oran Senia', 99999.00, 800.00, 3000, 97799.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 47 DAY), DATE_SUB(NOW(), INTERVAL 46 DAY), DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 43 DAY)),
(44, 1, 'ORD-2024-044', 'Jamal Oudina', '0731234569', 26, 'Médéa', 'Médéa Nord', 2499.00, 500.00, 0, 2999.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 46 DAY), DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 44 DAY), DATE_SUB(NOW(), INTERVAL 42 DAY)),
(45, 1, 'ORD-2024-045', 'Mounia Azaiez', '0651234567', 35, 'Boumerdès', 'Boumerdès Thenia', 3999.00, 500.00, 200, 4299.00, 'cancelled', 1, DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 44 DAY), NULL, NULL),
(46, 1, 'ORD-2024-046', 'Noureddine Bernou', '0741234569', 6, 'Béjaïa', 'Béjaïa Akbou', 29999.00, 500.00, 2000, 28499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 44 DAY), DATE_SUB(NOW(), INTERVAL 43 DAY), DATE_SUB(NOW(), INTERVAL 42 DAY), DATE_SUB(NOW(), INTERVAL 40 DAY)),
(47, 1, 'ORD-2024-047', 'Rim Boudghane', '0671234505', 19, 'Sétif', 'Sétif Ouenza', 1999.00, 500.00, 0, 2499.00, 'no_answer', 3, DATE_SUB(NOW(), INTERVAL 43 DAY), DATE_SUB(NOW(), INTERVAL 42 DAY), NULL, NULL),
(48, 1, 'ORD-2024-048', 'Salim Messaci', '0762334456', 25, 'Constantine', 'Constantine Zouaghi', 27999.00, 500.00, 500, 28499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 42 DAY), DATE_SUB(NOW(), INTERVAL 41 DAY), DATE_SUB(NOW(), INTERVAL 40 DAY), DATE_SUB(NOW(), INTERVAL 38 DAY)),
(49, 1, 'ORD-2024-049', 'Leila Brahimi', '0661234572', 23, 'Annaba', 'Annaba Zaouia', 4999.00, 500.00, 300, 5199.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 41 DAY), DATE_SUB(NOW(), INTERVAL 40 DAY), DATE_SUB(NOW(), INTERVAL 39 DAY), DATE_SUB(NOW(), INTERVAL 37 DAY)),
(50, 1, 'ORD-2024-050', 'Karim Boulares', '0701234571', 16, 'Algiers', 'Algiers Rais Hamidou', 99999.00, 500.00, 1000, 99499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 40 DAY), DATE_SUB(NOW(), INTERVAL 39 DAY), DATE_SUB(NOW(), INTERVAL 38 DAY), DATE_SUB(NOW(), INTERVAL 36 DAY)),

-- Continue filling up to 100 orders
(51, 1, 'ORD-2024-051', 'Habiba Debchi', '0721234569', 9, 'Blida', 'Blida Soumeria', 3999.00, 300.00, 100, 4199.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 39 DAY), DATE_SUB(NOW(), INTERVAL 38 DAY), DATE_SUB(NOW(), INTERVAL 37 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY)),
(52, 1, 'ORD-2024-052', 'Hassan Ouali', '0651234568', 31, 'Oran', 'Oran Karguentah', 5999.00, 800.00, 300, 6499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 38 DAY), DATE_SUB(NOW(), INTERVAL 37 DAY), DATE_SUB(NOW(), INTERVAL 36 DAY), DATE_SUB(NOW(), INTERVAL 34 DAY)),
(53, 1, 'ORD-2024-053', 'Souad Guenna', '0741234570', 26, 'Médéa', 'Médéa Kaid Zerrouk', 27999.00, 500.00, 800, 27699.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 37 DAY), DATE_SUB(NOW(), INTERVAL 36 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 33 DAY)),
(54, 1, 'ORD-2024-054', 'Walid Belkouch', '0661234573', 6, 'Béjaïa', 'Béjaïa Sidi Aich', 99999.00, 500.00, 0, 100499.00, 'cancelled', 2, DATE_SUB(NOW(), INTERVAL 36 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY), NULL, NULL),
(55, 1, 'ORD-2024-055', 'Hiba Menzli', '0671234506', 25, 'Constantine', 'Constantine Sidimabrouk', 1999.00, 500.00, 0, 2499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 34 DAY), DATE_SUB(NOW(), INTERVAL 33 DAY), DATE_SUB(NOW(), INTERVAL 31 DAY)),
(56, 1, 'ORD-2024-056', 'Mohammaad Chaabi', '0762334457', 16, 'Algiers', 'Algiers Bab Ezzouar', 2499.00, 300.00, 100, 2699.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 34 DAY), DATE_SUB(NOW(), INTERVAL 33 DAY), DATE_SUB(NOW(), INTERVAL 32 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY)),
(57, 1, 'ORD-2024-057', 'Amira Ghami', '0701234572', 35, 'Boumerdès', 'Boumerdès Ain Taya', 29999.00, 500.00, 1000, 29499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 33 DAY), DATE_SUB(NOW(), INTERVAL 32 DAY), DATE_SUB(NOW(), INTERVAL 31 DAY), DATE_SUB(NOW(), INTERVAL 29 DAY)),
(58, 1, 'ORD-2024-058', 'Raouf Zougari', '0651234569', 9, 'Blida', 'Blida Soumaâ', 4999.00, 300.00, 200, 5099.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 32 DAY), DATE_SUB(NOW(), INTERVAL 31 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 28 DAY)),
(59, 1, 'ORD-2024-059', 'Simone Khoubini', '0741234571', 31, 'Oran', 'Oran ES Senia', 27999.00, 800.00, 0, 28799.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 31 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 29 DAY), DATE_SUB(NOW(), INTERVAL 27 DAY)),
(60, 1, 'ORD-2024-060', 'Nasser Kabbache', '0661234574', 19, 'Sétif', 'Sétif Ain Malakoff', 99999.00, 500.00, 2000, 98499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 29 DAY), DATE_SUB(NOW(), INTERVAL 28 DAY), DATE_SUB(NOW(), INTERVAL 26 DAY)),

(61, 1, 'ORD-2024-061', 'Lalla Zina', '0671234507', 16, 'Algiers', 'Algiers Mustapha Pacha', 3999.00, 300.00, 200, 4099.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 29 DAY), DATE_SUB(NOW(), INTERVAL 28 DAY), DATE_SUB(NOW(), INTERVAL 27 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY)),
(62, 1, 'ORD-2024-062', 'Miloud Ouennaceur', '0721234570', 26, 'Médéa', 'Médéa Medea', 5999.00, 500.00, 300, 6199.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 28 DAY), DATE_SUB(NOW(), INTERVAL 27 DAY), DATE_SUB(NOW(), INTERVAL 26 DAY), DATE_SUB(NOW(), INTERVAL 24 DAY)),
(63, 1, 'ORD-2024-063', 'Siham Benzaouia', '0651234570', 6, 'Béjaïa', 'Béjaïa Soummama', 29999.00, 500.00, 500, 30499.00, 'cancelled', 1, DATE_SUB(NOW(), INTERVAL 27 DAY), DATE_SUB(NOW(), INTERVAL 26 DAY), NULL, NULL),
(64, 1, 'ORD-2024-064', 'Nadir Belahcene', '0762334458', 25, 'Constantine', 'Constantine Ain Abid', 1999.00, 500.00, 0, 2499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 26 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 24 DAY), DATE_SUB(NOW(), INTERVAL 22 DAY)),
(65, 1, 'ORD-2024-065', 'Karim Beggar', '0701234573', 23, 'Annaba', 'Annaba Chetouane', 27999.00, 500.00, 1000, 27499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 24 DAY), DATE_SUB(NOW(), INTERVAL 23 DAY), DATE_SUB(NOW(), INTERVAL 21 DAY)),
(66, 1, 'ORD-2024-066', 'Ouarda Mezaour', '0661234575', 35, 'Boumerdès', 'Boumerdès Issers', 4999.00, 500.00, 200, 5299.00, 'no_answer', 2, DATE_SUB(NOW(), INTERVAL 24 DAY), DATE_SUB(NOW(), INTERVAL 23 DAY), NULL, NULL),
(67, 1, 'ORD-2024-067', 'Khalid Houari', '0741234572', 9, 'Blida', 'Blida Boughara', 99999.00, 300.00, 0, 100299.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 23 DAY), DATE_SUB(NOW(), INTERVAL 22 DAY), DATE_SUB(NOW(), INTERVAL 21 DAY), DATE_SUB(NOW(), INTERVAL 19 DAY)),
(68, 1, 'ORD-2024-068', 'Yasmine Labed', '0671234508', 31, 'Oran', 'Oran Canastel', 2499.00, 800.00, 0, 3299.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 22 DAY), DATE_SUB(NOW(), INTERVAL 21 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY)),
(69, 1, 'ORD-2024-069', 'Mazen Bekkaria', '0651234571', 19, 'Sétif', 'Sétif Gaoua', 3999.00, 500.00, 100, 4399.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 21 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 19 DAY), DATE_SUB(NOW(), INTERVAL 17 DAY)),
(70, 1, 'ORD-2024-070', 'Rania Cherkabout', '0721234571', 26, 'Médéa', 'Médéa Saint Remy', 29999.00, 500.00, 1500, 28999.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 19 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 16 DAY)),

(71, 1, 'ORD-2024-071', 'Mourad Cherchali', '0661234576', 16, 'Algiers', 'Algiers Eucalyptus', 5999.00, 300.00, 300, 5999.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 19 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 17 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY)),
(72, 1, 'ORD-2024-072', 'Zahra Bouabdallah', '0741234573', 6, 'Béjaïa', 'Béjaïa Mekla', 27999.00, 500.00, 0, 28499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 17 DAY), DATE_SUB(NOW(), INTERVAL 16 DAY), DATE_SUB(NOW(), INTERVAL 14 DAY)),
(73, 1, 'ORD-2024-073', 'Safiya Belghith', '0651234572', 25, 'Constantine', 'Constantine Benbrahim', 1999.00, 500.00, 0, 2499.00, 'cancelled', 0, DATE_SUB(NOW(), INTERVAL 17 DAY), NULL, NULL, NULL),
(74, 1, 'ORD-2024-074', 'Bilal Amouhil', '0762334459', 9, 'Blida', 'Blida Ouled Aich', 99999.00, 300.00, 3000, 97299.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 16 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_SUB(NOW(), INTERVAL 12 DAY)),
(75, 1, 'ORD-2024-075', 'Emna Belhouari', '0671234509', 35, 'Boumerdès', 'Boumerdès Boudouaou', 2499.00, 500.00, 100, 2899.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_SUB(NOW(), INTERVAL 13 DAY), DATE_SUB(NOW(), INTERVAL 11 DAY)),
(76, 1, 'ORD-2024-076', 'Adel Mezzour', '0701234574', 31, 'Oran', 'Oran Hassi Bounif', 4999.00, 800.00, 200, 5599.00, 'postponed', 0, DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_SUB(NOW(), INTERVAL 13 DAY), NULL, NULL),
(77, 1, 'ORD-2024-077', 'Nisrine Hamadache', '0661234577', 19, 'Sétif', 'Sétif Tadjenanet', 29999.00, 500.00, 2000, 28499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 13 DAY), DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 11 DAY), DATE_SUB(NOW(), INTERVAL 9 DAY)),
(78, 1, 'ORD-2024-078', 'Zaki Khebli', '0741234574', 16, 'Algiers', 'Algiers Dar El Beida', 3999.00, 300.00, 0, 4299.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 11 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY)),
(79, 1, 'ORD-2024-079', 'Hanna Terami', '0651234573', 23, 'Annaba', 'Annaba Sedaoui', 27999.00, 500.00, 500, 28499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 11 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 9 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY)),
(80, 1, 'ORD-2024-080', 'Massoud Ghemchi', '0762334460', 26, 'Médéa', 'Médéa Zouaoui', 99999.00, 500.00, 1000, 99499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 9 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY)),

(81, 1, 'ORD-2024-081', 'Lilia Hammadi', '0671234510', 9, 'Blida', 'Blida Mehalma', 5999.00, 300.00, 400, 5899.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 9 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
(82, 1, 'ORD-2024-082', 'Omar Belhabib', '0721234572', 6, 'Béjaïa', 'Béjaïa Ouzoghene', 29999.00, 500.00, 0, 30499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY)),
(83, 1, 'ORD-2024-083', 'Karim Belkaid', '0651234574', 31, 'Oran', 'Oran Aoul El Brini', 1999.00, 800.00, 0, 2799.00, 'cancelled', 1, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY), NULL, NULL),
(84, 1, 'ORD-2024-084', 'Soraya Melani', '0661234578', 25, 'Constantine', 'Constantine Siroua', 27999.00, 500.00, 1000, 27499.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
(85, 1, 'ORD-2024-085', 'Tariq Ben Khaled', '0741234575', 35, 'Boumerdès', 'Boumerdès Corso', 4999.00, 500.00, 200, 5299.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
(86, 1, 'ORD-2024-086', 'Samira Feyz', '0671234511', 16, 'Algiers', 'Algiers Maarif', 99999.00, 300.00, 0, 100299.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
(87, 1, 'ORD-2024-087', 'Jazira Mehdi', '0661234579', 19, 'Sétif', 'Sétif Tamentout', 3999.00, 500.00, 100, 4399.00, 'no_answer', 1, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), NULL, NULL),
(88, 1, 'ORD-2024-088', 'Bachir Kouhali', '0701234575', 9, 'Blida', 'Blida Ramville', 2499.00, 300.00, 0, 2799.00, 'delivered', 0, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), NOW(), NOW()),
(89, 1, 'ORD-2024-089', 'Marta Belkaid', '0741234576', 26, 'Médéa', 'Médéa Bou Medel', 29999.00, 500.00, 1000, 29499.00, 'confirmed', 0, DATE_SUB(NOW(), INTERVAL 1 DAY), NOW(), NULL, NULL),
(90, 1, 'ORD-2024-090', 'Lale Bellaoui', '0651234575', 6, 'Béjaïa', 'Béjaïa Sidi Ali', 5999.00, 500.00, 300, 6199.00, 'processing', 0, NOW(), NOW(), NULL, NULL);

-- ============================================================
-- Order Items (1-2 items per order)
-- ============================================================

-- Sample order items
INSERT INTO `order_items` (`order_id`, `product_id`, `product_name`, `quantity`, `price`, `total`) VALUES
(1, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(2, 1, 'Samsung Galaxy A13', 1, 27999.00, 27999.00),
(3, 4, 'OnePlus 10', 1, 42999.00, 42999.00),
(4, 6, 'Wireless Charger', 1, 4999.00, 4999.00),
(5, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(6, 7, 'Phone Case Leather', 2, 2499.00, 4998.00),
(7, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(8, 8, 'Cotton T-Shirt White', 2, 1999.00, 3998.00),
(9, 10, 'Coffee Maker 1.5L', 1, 5999.00, 5999.00),
(10, 12, 'Running Shoes Adidas', 1, 12999.00, 12999.00),
(11, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(12, 7, 'Phone Case Leather', 1, 2499.00, 2499.00),
(13, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(14, 11, 'LED Desk Lamp', 1, 3499.00, 3499.00),
(15, 5, 'USB-C Cable 2m', 1, 1999.00, 1999.00),
(16, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(17, 6, 'Wireless Charger', 1, 4999.00, 4999.00),
(18, 4, 'OnePlus 10', 1, 42999.00, 42999.00),
(19, 10, 'Coffee Maker 1.5L', 1, 5999.00, 5999.00),
(20, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(21, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(22, 8, 'Cotton T-Shirt White', 1, 3999.00, 3999.00),
(23, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(24, 5, 'USB-C Cable 2m', 1, 1999.00, 1999.00),
(25, 6, 'Wireless Charger', 1, 4999.00, 4999.00),
(26, 7, 'Phone Case Leather', 1, 2499.00, 2499.00),
(27, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(28, 9, 'Jeans Blue Slim Fit', 1, 3999.00, 3999.00),
(29, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(30, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(31, 5, 'USB-C Cable 2m', 1, 1999.00, 1999.00),
(32, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(33, 8, 'Cotton T-Shirt White', 1, 3999.00, 3999.00),
(34, 10, 'Coffee Maker 1.5L', 1, 5999.00, 5999.00),
(35, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(36, 6, 'Wireless Charger', 1, 4999.00, 4999.00),
(37, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(38, 7, 'Phone Case Leather', 1, 2499.00, 2499.00),
(39, 8, 'Cotton T-Shirt White', 1, 3999.00, 3999.00),
(40, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(41, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(42, 10, 'Coffee Maker 1.5L', 1, 5999.00, 5999.00),
(43, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(44, 7, 'Phone Case Leather', 1, 2499.00, 2499.00),
(45, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(46, 3, 'Realme 9 Pro', 1, 29999.00, 29999.00),
(47, 5, 'USB-C Cable 2m', 1, 1999.00, 1999.00),
(48, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(49, 6, 'Wireless Charger', 1, 4999.00, 4999.00),
(50, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(51, 8, 'Cotton T-Shirt White', 1, 3999.00, 3999.00),
(52, 10, 'Coffee Maker 1.5L', 1, 5999.00, 5999.00),
(53, 1, 'Samsung Galaxy A13', 1, 27999.00, 27999.00),
(54, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(55, 5, 'USB-C Cable 2m', 1, 1999.00, 1999.00),
(56, 7, 'Phone Case Leather', 1, 2499.00, 2499.00),
(57, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(58, 6, 'Wireless Charger', 1, 4999.00, 4999.00),
(59, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(60, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(61, 8, 'Cotton T-Shirt White', 1, 3999.00, 3999.00),
(62, 10, 'Coffee Maker 1.5L', 1, 5999.00, 5999.00),
(63, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(64, 5, 'USB-C Cable 2m', 1, 1999.00, 1999.00),
(65, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(66, 6, 'Wireless Charger', 1, 4999.00, 4999.00),
(67, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(68, 7, 'Phone Case Leather', 1, 2499.00, 2499.00),
(69, 8, 'Cotton T-Shirt White', 1, 3999.00, 3999.00),
(70, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(71, 10, 'Coffee Maker 1.5L', 1, 5999.00, 5999.00),
(72, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(73, 5, 'USB-C Cable 2m', 1, 1999.00, 1999.00),
(74, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(75, 7, 'Phone Case Leather', 1, 2499.00, 2499.00),
(76, 6, 'Wireless Charger', 1, 4999.00, 4999.00),
(77, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(78, 8, 'Cotton T-Shirt White', 1, 3999.00, 3999.00),
(79, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(80, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(81, 10, 'Coffee Maker 1.5L', 1, 5999.00, 5999.00),
(82, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(83, 5, 'USB-C Cable 2m', 1, 1999.00, 1999.00),
(84, 3, 'Realme 9 Pro', 1, 27999.00, 27999.00),
(85, 6, 'Wireless Charger', 1, 4999.00, 4999.00),
(86, 2, 'iPhone 12 Pro', 1, 99999.00, 99999.00),
(87, 7, 'Phone Case Leather', 1, 3999.00, 3999.00),
(88, 8, 'Cotton T-Shirt White', 1, 2499.00, 2499.00),
(89, 1, 'Samsung Galaxy A13', 1, 29999.00, 29999.00),
(90, 10, 'Coffee Maker 1.5L', 1, 5999.00, 5999.00);

-- ============================================================
-- Database Ready for Testing
-- ============================================================

SELECT 'Database setup complete!' as status;
SELECT COUNT(*) as total_stores FROM stores;
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_products FROM products;
SELECT COUNT(*) as total_orders FROM orders;
SELECT COUNT(*) as total_order_items FROM order_items;
SELECT COUNT(*) as total_wilayas FROM wilayas;
