# DasKitta

A unified platform for NEPSE investors to manage multiple Meroshare accounts, apply for IPOs in bulk, track holdings, and monitor market activity from one app.

Live app: [https://daskitta.vercel.app](https://daskitta.vercel.app)

## Latest Upgrades

- Backend upgraded to Java 21 and Spring Boot 3.5.14.
- Frontend upgraded to React 19, React Router 7, and Vite 8.
- PWA support added with vite-plugin-pwa (auto-update service worker + installable app manifest).
- Auth flow expanded with OTP verification, OTP resend, and profile update APIs.
- Account management expanded with account update endpoint.
- Dockerized backend build updated to Eclipse Temurin 21 runtime.

## Features

### Authentication and User Profile

- JWT-based authentication.
- Registration and login.
- OTP verification and resend flow.
- Profile actions: change password, change username, request/confirm email change.
- Protected frontend routes with automatic redirect on unauthorized responses.

### Meroshare Account Management

- Add and manage multiple Meroshare accounts under one DasKitta user.
- Fetch DP list and bank list by DP.
- Update account credentials (password and pin) without re-adding an account.
- View per-account information and portfolio.

### IPO and CDSC

- View open IPOs and public share list.
- Apply to IPOs across selected accounts.
- Check IPO results by share ID (with optional guest BOID check).
- Track application history and applied companies.
- View CDSC summary data.

### NEPSE Market Data

- Live market feed, index, and summary.
- Top gainers, losers, turnover, trades, and transactions.
- Company details, price-volume history, market depth, and floorsheet data.
- Sector and index graph endpoints for charting in the frontend.

### Progressive Web App

- Installable app experience on supported browsers.
- Auto-updating service worker registration.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router DOM 7, Axios, Framer Motion, Recharts, Vite 8 |
| Backend | Java 21, Spring Boot 3.5.14, Spring Security, Spring Data JPA, Spring WebFlux |
| Database | PostgreSQL |
| Auth/Security | JWT (jjwt 0.12.5), AES encryption for external credentials |
| PWA | vite-plugin-pwa |

## Project Structure

```text
DasKitta
├── backend/
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/meroshare/backend/
│       │   ├── controller/     # Auth, Account, IPO, Nepse, Ping
│       │   ├── service/        # Business and integration services
│       │   ├── security/       # JWT filter, token utils, encryption utils
│       │   ├── repository/     # Spring Data JPA repositories
│       │   ├── entity/         # JPA entities
│       │   └── dto/            # Request/response models
│       └── resources/
│           ├── application.properties
│           └── application-local.properties
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── api/                # API clients: auth/accounts/ipo/nepse
│       ├── components/         # Shared UI components and route guards
│       ├── context/            # Auth, account, notification, theme context
│       └── pages/              # Home, dashboard, IPO, NEPSE, portfolio, settings
└── docker-compose.yml          # PostgreSQL service for local setup
```

## API Overview

Base URL (local): `http://localhost:8080/api`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify-otp`
- `POST /auth/resend-otp`
- `PATCH /auth/password`
- `PATCH /auth/username`
- `POST /auth/email/request-change`
- `POST /auth/email/confirm-change`
- `GET /auth/me`

### Accounts

- `GET /accounts/dp-list`
- `GET /accounts/bank-by-dp/{dpId}`
- `GET /accounts`
- `POST /accounts`
- `PATCH /accounts/{id}`
- `DELETE /accounts/{id}`
- `GET /accounts/{id}/portfolio`
- `GET /accounts/{id}/info`

### IPO

- `GET /ipo/applied-companies`
- `GET /ipo/shares`
- `GET /ipo/open`
- `POST /ipo/apply`
- `GET /ipo/result/{shareId}`
- `GET /ipo/history`
- `GET /ipo/cdsc-summary`

### NEPSE

- `GET /nepse/live-market`
- `GET /nepse/index`
- `GET /nepse/sub-indices`
- `GET /nepse/summary`
- `GET /nepse/is-open`
- `GET /nepse/top-gainers`
- `GET /nepse/top-losers`
- `GET /nepse/top-turnover`
- `GET /nepse/top-trade`
- `GET /nepse/top-transaction`
- `GET /nepse/supply-demand`
- `GET /nepse/companies`
- `GET /nepse/price-volume`
- `GET /nepse/security-list`
- `GET /nepse/company/details?symbol=...`
- `GET /nepse/scrip-price-graph?symbol=...`
- `GET /nepse/price-volume-history?symbol=...`
- `GET /nepse/market-depth?symbol=...`
- `GET /nepse/floorsheet`
- `GET /nepse/floorsheet/company?symbol=...`
- `GET /nepse/graph/*`

For full payload/response examples, see:

- [MEROSHARE_API_REFERENCE.md](MEROSHARE_API_REFERENCE.md)
- [NEPSE_API_REFERENCE.md](NEPSE_API_REFERENCE.md)

## Setup and Run

### Prerequisites

- Java 21+
- Node.js 20+ and npm
- PostgreSQL 14+ (or Docker)
- Maven wrapper (`./mvnw`) is included

### 1. Start PostgreSQL

Option A: local PostgreSQL instance

```sql
CREATE DATABASE meroshare_db;
```

Option B: Docker Compose

```bash
docker compose up -d
```

### 2. Backend Configuration

Backend uses profiles:

- `local` is default (`application.properties`)
- `prod` is for production DB overrides (`application-prod.properties`)

Set environment variables (recommended) before running:

```bash
export PORT=8080
export DATABASE_URL='jdbc:postgresql://localhost:5432/meroshare_db'
export DB_USERNAME='postgres'
export DB_PASSWORD='your_password'

export APP_JWT_SECRET='replace_with_a_strong_secret'
export APP_JWT_EXPIRATION_MS='2592000000'
export CORS_ALLOWED_ORIGINS='your_host_url'

export MEROSHARE_BASE_URL='https://webbackend.cdsc.com.np/api'
export NEPSE_API_URL='http://localhost:8000'

export SPRING_MAIL_USERNAME='your_email'
export SPRING_MAIL_PASSWORD='your_app_password'
```

To run with default profile:

```bash
cd backend
./mvnw spring-boot:run
```

### 3. Frontend Configuration

Create `frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:8080/api
```

Run frontend:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

### 4. Build for Production

```bash
# Backend
cd backend
./mvnw clean package
java -jar target/*.jar

# Frontend
cd ../frontend
npm run build
npm run preview
```

## Docker Notes

- `docker-compose.yml` currently provisions PostgreSQL for local development.
- `backend/Dockerfile` is multi-stage and builds/runs with Java 21 images.

To build backend image manually:

```bash
cd backend
docker build -t daskitta-backend .
docker run --rm -p 8080:8080 daskitta-backend
```

## Security Notes

- JWT secures protected APIs.
- External account credentials are encrypted before persistence.
- Route guarding is enforced in frontend protected routes and API interceptor behavior.

## Developer

Prasant Bhattarai

- Portfolio: [https://prasant-bhattarai.com.np](https://prasant-bhattarai.com.np)
- GitHub: [https://github.com/coprashant](https://github.com/coprashant)