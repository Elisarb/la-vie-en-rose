CREATE TABLE shop_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  store_address TEXT NOT NULL DEFAULT '',
  store_lat REAL,
  store_lng REAL,
  pickup_lead_minutes INTEGER NOT NULL DEFAULT 60 CHECK (pickup_lead_minutes BETWEEN 0 AND 2880),
  delivery_lead_minutes INTEGER NOT NULL DEFAULT 300 CHECK (delivery_lead_minutes BETWEEN 0 AND 2880),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE delivery_geocache (
  address_key TEXT PRIMARY KEY NOT NULL,
  display_address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

PRAGMA optimize;
