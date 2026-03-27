-- MindCheck Database Schema
-- MySQL 8.0

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ============================================================================
-- Users Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- NULL for OAuth users
    nickname VARCHAR(100),
    role ENUM('user', 'admin') DEFAULT 'user',
    age_range VARCHAR(20),
    goal VARCHAR(100),

    -- OAuth fields
    oauth_provider ENUM('google', 'facebook') DEFAULT NULL,
    oauth_id VARCHAR(255) DEFAULT NULL,

    -- Profile
    avatar_url VARCHAR(500),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,

    -- Subscription (Stripe)
    is_pro BOOLEAN DEFAULT FALSE,
    subscription_plan VARCHAR(50) DEFAULT NULL,
    subscription_expires_at TIMESTAMP NULL,
    stripe_customer_id VARCHAR(255) DEFAULT NULL,
    stripe_subscription_id VARCHAR(255) DEFAULT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,

    -- Indexes
    INDEX idx_email (email),
    INDEX idx_oauth (oauth_provider, oauth_id),
    INDEX idx_role (role),
    INDEX idx_created_at (created_at),
    INDEX idx_stripe_customer (stripe_customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Sessions Table (Refresh Tokens)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    refresh_token VARCHAR(500) NOT NULL,
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),

    -- Expiration
    expires_at TIMESTAMP NOT NULL,

    -- Status
    is_revoked BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_refresh_token (refresh_token(255)),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Scan History Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS scan_history (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,

    -- PHQ-9 Related
    phq9_score INT NOT NULL,
    severity VARCHAR(50) NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,

    -- Wellness Scores (0-100)
    energy_level INT,
    stress_level INT,
    fatigue_level INT,

    -- Risk Indicators (JSON)
    risk_indicators JSON,

    -- Facial Analysis Data (JSON - summary only, no raw data)
    facial_summary JSON,

    -- Session metadata
    session_id VARCHAR(36),
    window_count INT,
    total_frames INT,
    scan_duration_seconds INT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_phq9_score (phq9_score),
    INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- User Baselines Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_baselines (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,

    -- Baseline data (JSON)
    baseline_data JSON NOT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Admin Activity Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id VARCHAR(36) PRIMARY KEY,
    admin_id VARCHAR(36) NOT NULL,

    -- Action details
    action VARCHAR(50) NOT NULL,  -- 'view_user', 'edit_user', 'delete_user', 'view_scan', etc.
    target_type VARCHAR(50),      -- 'user', 'scan', etc.
    target_id VARCHAR(36),

    -- Additional context (JSON)
    details JSON,

    -- Request info
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),

    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_admin_id (admin_id),
    INDEX idx_action (action),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Insert Default Admin User
-- Password: admin123 (bcrypt hash)
-- ============================================================================
INSERT INTO users (id, email, password_hash, nickname, role, is_active, is_verified)
VALUES (
    'admin-default-uuid-0001',
    'admin@mindcheck.app',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.Sw1cL6Q1XGz9Km',  -- admin123
    'Admin',
    'admin',
    TRUE,
    TRUE
) ON DUPLICATE KEY UPDATE id = id;

-- ============================================================================
-- Wellness opt-in + vector / PHQ-9 (เก็บเมื่อผู้ใช้ยินยอม — ไม่มี raw image)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_wellness_opt_in (
    user_id VARCHAR(36) PRIMARY KEY,
    share_vectors BOOLEAN DEFAULT FALSE,
    share_phq9 BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wellness_vector_samples (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    dim INT NOT NULL,
    time_epoch VARCHAR(32),
    session_id VARCHAR(36),
    vector_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_wellness_vec_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wellness_phq9_labels (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    total_score INT NOT NULL,
    answers_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_wellness_phq9_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wellness_training_jobs (
    id VARCHAR(36) PRIMARY KEY,
    status VARCHAR(32) NOT NULL,
    payload_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    INDEX idx_wellness_job_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
