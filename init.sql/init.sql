-- SmartCart Database Schema
-- Covers both app (parser/lists) and app2 (auth/store) schemas
-- Run this to reset and recreate the entire database

DROP SCHEMA IF EXISTS app CASCADE;
DROP SCHEMA IF EXISTS app2 CASCADE;

-- ============================================
-- SCHEMA: app
-- Used by: parser.js (XML data import), socket.io (shopping lists)
-- ============================================
CREATE SCHEMA app;

-- ============================================
-- app.chains - Retail chain info (populated by parser)
-- ============================================
CREATE TABLE app.chains (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  logo_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- app.sub_chains - Sub-chains within a retail chain
-- ============================================
CREATE TABLE app.sub_chains (
  id INT PRIMARY KEY,
  chain_id BIGINT NOT NULL REFERENCES app.chains(id) ON DELETE CASCADE,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- app.branches - Store branch locations
-- ============================================
CREATE TABLE app.branches (
  id INT PRIMARY KEY,
  chain_id BIGINT NOT NULL REFERENCES app.chains(id) ON DELETE CASCADE,
  sub_chain_id INT REFERENCES app.sub_chains(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  address VARCHAR(255),
  city VARCHAR(100),
  latitude DECIMAL(9, 6),
  longitude DECIMAL(9, 6),
  bikoret_no INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- app.items - Products (populated by parser)
-- ============================================
CREATE TABLE app.items (
  id SERIAL PRIMARY KEY,
  item_code VARCHAR(50) NOT NULL,
  barcode VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  manufacturer_country VARCHAR(100),
  description VARCHAR(500),
  category VARCHAR(100),
  unit_qty VARCHAR(50),
  is_weighted BOOLEAN DEFAULT FALSE,
  popularity_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(item_code, manufacturer, is_weighted)
);

-- ============================================
-- app.prices - Item prices per branch (populated by parser)
-- ============================================
CREATE TABLE app.prices (
  id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES app.items(id) ON DELETE CASCADE,
  branch_id INT NOT NULL REFERENCES app.branches(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 4),
  item_status INT,
  allow_discount BOOLEAN DEFAULT TRUE,
  bikoret_no INT,
  price_update_time TIMESTAMP,
  last_sale_datetime TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(item_id, branch_id)
);

CREATE INDEX idx_prices_item ON app.prices(item_id);
CREATE INDEX idx_prices_branch ON app.prices(branch_id);
CREATE INDEX idx_prices_update_time ON app.prices(price_update_time);

-- ============================================
-- app.list - Shopping lists (socket.io)
-- ============================================
CREATE TABLE app.list (
  id SERIAL PRIMARY KEY,
  list_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- app.list_members - List members with roles (socket.io: create_list)
-- ============================================
CREATE TABLE app.list_members (
  id SERIAL PRIMARY KEY,
  list_id INT NOT NULL REFERENCES app.list(id) ON DELETE CASCADE,
  user_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

-- ============================================
-- app.list_items - Items in a shopping list (socket.io: send_item, toggle_item)
-- ============================================
CREATE TABLE app.list_items (
  id SERIAL PRIMARY KEY,
  listId INT NOT NULL REFERENCES app.list(id) ON DELETE CASCADE,
  itemName VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2),
  storeName VARCHAR(255),
  quantity DECIMAL(10, 2) DEFAULT 1.0,
  is_checked BOOLEAN DEFAULT FALSE,
  addby INT,
  paid_by INT,
  paid_at TIMESTAMP,
  note TEXT,
  note_by INT,
  product_id INT REFERENCES app.items(id) ON DELETE SET NULL,
  addat TIMESTAMP DEFAULT NOW(),
  updatedat TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_list_items_listid ON app.list_items("listid");
CREATE INDEX idx_list_items_product_id ON app.list_items(product_id);

-- ============================================
-- app.list_users - Users joined to a list (socket.io: user_joined)
-- ============================================
CREATE TABLE app.list_users (
  id SERIAL PRIMARY KEY,
  list_id INT NOT NULL REFERENCES app.list(id) ON DELETE CASCADE,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

-- ============================================
-- app.list_item_comments - Comments/discussion on list items
-- ============================================
CREATE TABLE app.list_item_comments (
  id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES app.list_items(id) ON DELETE CASCADE,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_item_comments_item ON app.list_item_comments(item_id);

-- ============================================
-- app.list_invites - Invite links for joining lists
-- ============================================
CREATE TABLE app.list_invites (
  id SERIAL PRIMARY KEY,
  list_id INT NOT NULL REFERENCES app.list(id) ON DELETE CASCADE,
  invite_code VARCHAR(64) NOT NULL UNIQUE,
  created_by INT NOT NULL,
  expires_at TIMESTAMP,
  max_uses INT,
  use_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invites_code ON app.list_invites(invite_code);

-- ============================================
-- app.list_templates - Saved template lists
-- ============================================
CREATE TABLE app.list_templates (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  source_list_id INT REFERENCES app.list(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_user ON app.list_templates(user_id);

-- ============================================
-- app.template_items - Items in a template list
-- ============================================
CREATE TABLE app.template_items (
  id SERIAL PRIMARY KEY,
  template_id INT NOT NULL REFERENCES app.list_templates(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1.0,
  note TEXT,
  sort_order INT DEFAULT 0
);

CREATE INDEX idx_template_items_template ON app.template_items(template_id);

-- ============================================
-- app.items barcode index for barcode scanning
-- ============================================
CREATE INDEX idx_items_barcode ON app.items(barcode);

-- ============================================
-- SCHEMA: app2
-- Used by: server.js (auth, store API)
-- ============================================
CREATE SCHEMA app2;

-- ============================================
-- app2.users - User accounts and authentication
-- ============================================
CREATE TABLE app2.users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  username VARCHAR(100) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  parent_id INT REFERENCES app2.users(id) ON DELETE CASCADE,
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON app2.users(email);
CREATE INDEX idx_users_username ON app2.users(username);
CREATE INDEX idx_users_parent ON app2.users(parent_id);

-- ============================================
-- app2.tokens - Auth tokens (refresh, email_verify, reset_password)
-- user_id is nullable for email_verify tokens (user not yet created)
-- ============================================
CREATE TABLE app2.tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES app2.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  data TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tokens_user_id ON app2.tokens(user_id);
CREATE INDEX idx_tokens_type ON app2.tokens(type);
CREATE INDEX idx_tokens_expires_at ON app2.tokens(expires_at);
CREATE INDEX idx_tokens_user_type ON app2.tokens(user_id, type);

-- ============================================
-- app2.chains - Retail chains (for store API)
-- ============================================
CREATE TABLE app2.chains (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_app2_chains_name ON app2.chains(name);

-- ============================================
-- app2.branches - Branch locations (for store API)
-- ============================================
CREATE TABLE app2.branches (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL REFERENCES app2.chains(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_app2_branches_chain_id ON app2.branches(chain_id);

-- ============================================
-- app2.items - Products (for store API)
-- ============================================
CREATE TABLE app2.items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_app2_items_name ON app2.items(name);
CREATE INDEX idx_app2_items_category ON app2.items(category);

-- ============================================
-- app2.prices - Item prices per branch (for store API)
-- ============================================
CREATE TABLE app2.prices (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES app2.items(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES app2.branches(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(item_id, branch_id)
);

CREATE INDEX idx_app2_prices_item_id ON app2.prices(item_id);
CREATE INDEX idx_app2_prices_branch_id ON app2.prices(branch_id);
CREATE INDEX idx_app2_prices_price ON app2.prices(price);

-- ============================================
-- app2.kid_requests - Pending item requests from linked children
-- ============================================
CREATE TABLE app2.kid_requests (
  id SERIAL PRIMARY KEY,
  child_id INT NOT NULL REFERENCES app2.users(id) ON DELETE CASCADE,
  parent_id INT NOT NULL REFERENCES app2.users(id) ON DELETE CASCADE,
  list_id INT NOT NULL REFERENCES app.list(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2),
  store_name VARCHAR(255),
  quantity DECIMAL(10, 2) DEFAULT 1.0,
  status VARCHAR(20) DEFAULT 'pending',
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  product_id INT REFERENCES app.items(id) ON DELETE SET NULL
);

CREATE INDEX idx_kid_requests_parent_pending ON app2.kid_requests(parent_id, status);

-- ============================================
-- Auto-update updated_at on app2.users
-- ============================================
CREATE OR REPLACE FUNCTION app2.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON app2.users
  FOR EACH ROW
  EXECUTE FUNCTION app2.update_updated_at_column();
