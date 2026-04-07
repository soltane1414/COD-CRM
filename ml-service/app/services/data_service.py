import logging
import pandas as pd
from pathlib import Path
from typing import Optional

import mysql.connector
from app.config import settings

logger = logging.getLogger(__name__)


class DataService:
    """Data loading from MySQL database or CSV files."""

    def __init__(self):
        self._connection = None

    def _get_connection(self):
        """Get or create MySQL connection."""
        if self._connection is None or not self._connection.is_connected():
            try:
                self._connection = mysql.connector.connect(
                    host=settings.DB_HOST,
                    port=settings.DB_PORT,
                    database=settings.DB_NAME,
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,
                )
            except mysql.connector.Error as e:
                logger.error("Database connection failed: %s", e)
                raise
        return self._connection

    def load_orders(self, store_id: Optional[int] = None, limit: Optional[int] = None) -> pd.DataFrame:
        """Load orders from the database."""
        conn = self._get_connection()
        query = """
            SELECT o.*, w.name as wilaya_name, w.shipping_zone,
                   COUNT(oi.id) as n_items,
                 AVG(COALESCE(p.weight, 0)) as avg_product_weight,
                 AVG(CHAR_LENGTH(COALESCE(p.description, ''))) as avg_desc_length,
                 AVG(CHAR_LENGTH(COALESCE(p.name, ''))) as avg_name_length,
                   GROUP_CONCAT(DISTINCT oi.product_name) as product_names,
                   GROUP_CONCAT(DISTINCT p.category) as product_categories
            FROM orders o
            LEFT JOIN wilayas w ON o.wilaya_id = w.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
        """
        params = []
        if store_id:
            query += " WHERE o.store_id = %s"
            params.append(store_id)
        query += " GROUP BY o.id ORDER BY o.created_at DESC"
        if limit:
            query += f" LIMIT {int(limit)}"

        return pd.read_sql(query, conn, params=params or None)

    def load_deliveries(self, store_id: Optional[int] = None) -> pd.DataFrame:
        """Load deliveries from the database."""
        conn = self._get_connection()
        query = "SELECT * FROM deliveries"
        params = []
        if store_id:
            query += " WHERE store_id = %s"
            params.append(store_id)
        return pd.read_sql(query, conn, params=params or None)

    def load_returns(self, store_id: Optional[int] = None) -> pd.DataFrame:
        """Load returns from the database."""
        conn = self._get_connection()
        query = "SELECT * FROM returns"
        params = []
        if store_id:
            query += " WHERE store_id = %s"
            params.append(store_id)
        return pd.read_sql(query, conn, params=params or None)

    def load_olist_data(self, data_dir: Optional[Path] = None) -> dict:
        """Load Olist CSV files into DataFrames."""
        data_dir = data_dir or settings.DATA_DIR

        files = {
            "orders": "olist_orders_dataset.csv",
            "customers": "olist_customers_dataset.csv",
            "items": "olist_order_items_dataset.csv",
            "products": "olist_products_dataset.csv",
            "payments": "olist_order_payments_dataset.csv",
            "reviews": "olist_order_reviews_dataset.csv",
            "geolocation": "olist_geolocation_dataset.csv",
        }

        data = {}
        for key, filename in files.items():
            path = data_dir / filename
            if path.exists():
                data[key] = pd.read_csv(path)
                logger.info("Loaded %s: %d rows", filename, len(data[key]))
            else:
                logger.warning("File not found: %s", path)
                data[key] = pd.DataFrame()

        return data

    def close(self):
        """Close database connection."""
        if self._connection and self._connection.is_connected():
            self._connection.close()


# Singleton instance
data_service = DataService()
