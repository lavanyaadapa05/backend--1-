-- Creates the payments_db schema and grants access to root (matches
-- application.properties credentials). Executed automatically by the MySQL
-- container on first startup via /docker-entrypoint-initdb.d.

CREATE DATABASE IF NOT EXISTS payments_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE payments_db;

-- Tables are created automatically by Hibernate (spring.jpa.hibernate.ddl-auto=update)
-- but the reference DDL below documents the schema for manual setup / review.

CREATE TABLE IF NOT EXISTS payments (
    id                    VARCHAR(36) PRIMARY KEY,
    idempotency_key       VARCHAR(100) UNIQUE,
    amount                DECIMAL(19,4) NOT NULL,
    currency              VARCHAR(3) NOT NULL,
    source_account        VARCHAR(34) NOT NULL,
    destination_account   VARCHAR(34) NOT NULL,
    payment_method        VARCHAR(30) NOT NULL,
    payment_type          VARCHAR(20) NOT NULL,
    status                VARCHAR(20) NOT NULL,
    reference             VARCHAR(255),
    upi_id                VARCHAR(100),
    card_number_masked    VARCHAR(25),
    card_holder_name      VARCHAR(100),
    card_expiry           VARCHAR(7),
    card_network          VARCHAR(20),
    bank_name             VARCHAR(100),
    bank_account_type     VARCHAR(20),
    sender_bank_name      VARCHAR(100),
    beneficiary_bank_name VARCHAR(100),
    ifsc_code             VARCHAR(20),
    mobile_or_account_number VARCHAR(50),
    swift_bic_code        VARCHAR(20),
    beneficiary_country   VARCHAR(100),
    payment_purpose       VARCHAR(100),
    routing_number        VARCHAR(30),
    error_code            VARCHAR(40),
    error_message         VARCHAR(500),
    version               BIGINT,
    created_at            DATETIME(6) NOT NULL,
    updated_at            DATETIME(6) NOT NULL,
    INDEX idx_payment_status (status),
    INDEX idx_payment_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_status_history (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_id    VARCHAR(36) NOT NULL,
    from_status   VARCHAR(20),
    to_status     VARCHAR(20) NOT NULL,
    triggered_by  VARCHAR(50) NOT NULL,
    notes         VARCHAR(500),
    changed_at    DATETIME(6) NOT NULL,
    INDEX idx_history_payment_id (payment_id),
    CONSTRAINT fk_history_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

