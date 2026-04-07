-- ============================================================
-- COD CRM — Database Migration: Order ML Feature Storage
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `orders`
    ADD COLUMN IF NOT EXISTS `ml_features` JSON DEFAULT NULL AFTER `source`;

SET FOREIGN_KEY_CHECKS = 1;
