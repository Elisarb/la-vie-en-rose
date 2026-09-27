CREATE TABLE product_images (
  image_key TEXT PRIMARY KEY NOT NULL,
  content_type TEXT NOT NULL,
  image_data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
