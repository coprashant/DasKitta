-- Database: meroshare_db

CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    dpid VARCHAR(10) NOT NULL,
    username VARCHAR(50) NOT NULL,
    password TEXT NOT NULL, -- Encrypted string
    crn VARCHAR(20) NOT NULL,
    pin VARCHAR(10) NOT NULL, -- Encrypted string
    boid VARCHAR(16) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ipo_results (
    id SERIAL PRIMARY KEY,
    boid VARCHAR(16) REFERENCES accounts(boid),
    company_name VARCHAR(255),
    status VARCHAR(50), -- 'Allotted' or 'Not Allotted'
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);