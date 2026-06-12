# DasKitta

> A unified platform for NEPSE investors — manage multiple Meroshare accounts, apply to IPOs in bulk, track your portfolio, and monitor live market data from a single dashboard.

**Live:** [daskitta.vercel.app](https://daskitta.vercel.app)

---

## Features

**Account Management**
- Register and log in with JWT-based session management
- Add and manage multiple Meroshare accounts from one place
- AES-encrypted storage of Meroshare credentials — passwords are never stored in plaintext

**IPO**
- View all currently open IPOs
- Apply to open IPOs across all linked accounts simultaneously
- Check allotment results for all linked accounts
- Track full application history with status updates
- Browse upcoming IPO listings

**Portfolio & Market**
- View portfolio holdings per account
- CDSC transaction history
- Live NEPSE index data with real-time ticker strip
- Day gainers and losers
- Live price chart for every listed scrip
- Dashboard overview with activity summaries

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js (Vite), React Router, Axios, Custom CSS |
| Backend | Java 17, Spring Boot 3, Spring Security, JWT |
| Database | PostgreSQL, Spring Data JPA |
| Security | JWT authentication, AES credential encryption |

---

## Project Structure

```
DasKitta
├── backend/src/main/java/com/meroshare/backend
│   ├── config/          # Security configuration
│   ├── controller/      # REST controllers (Auth, Account, IPO, Nepse, Ping)
│   ├── dto/             # Request/response data transfer objects
│   ├── entity/          # JPA entities (AppUser, MeroshareAccount, IpoApplication, CdscResultCache)
│   ├── exception/       # Global exception handler
│   ├── repository/      # Spring Data JPA repositories
│   ├── security/        # JWT filter, JWT util, AES encryption, UserDetailsService
│   └── service/
│       ├── nepse/       # NEPSE client, token manager, symbol resolver, dummy ID manager
│       ├── AuthService, IpoService, MeroshareApiService, NepseService, ...
│
└── frontend/src
    ├── api/             # Axios API clients (auth, accounts, ipo, nepse)
    ├── components/      # Navbar, Footer, ...
    ├── context/         # Auth, Account, Notification, Theme contexts
    └── pages/           # Home, Auth, Dashboard, ...
```

---

## API Reference

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new user | — |
| `POST` | `/api/auth/login` | Login and receive JWT | — |
| `GET` | `/api/accounts` | List Meroshare accounts | ✓ |
| `POST` | `/api/accounts` | Add a Meroshare account | ✓ |
| `DELETE` | `/api/accounts/{id}` | Remove a Meroshare account | ✓ |
| `GET` | `/api/ipo/open` | Get currently open IPOs | ✓ |
| `POST` | `/api/ipo/apply` | Apply for an IPO | ✓ |
| `GET` | `/api/ipo/result` | Check allotment results | ✓ |
| `GET` | `/api/ipo/history` | Get application history | ✓ |
| `GET` | `/api/nepse/...` | Live NEPSE data, gainers, losers, charts | ✓ |

---

## Setup & Installation

### Prerequisites

- Java 17+
- Node.js 18+ and npm
- PostgreSQL 14+
- Maven (or use the included `mvnw` wrapper)

### 1. Database

```sql
CREATE DATABASE meroshare_db;
```

### 2. Backend — `backend/src/main/resources/application.properties`

```properties
server.port=8080

spring.datasource.url=jdbc:postgresql://localhost:5432/meroshare_db
spring.datasource.username=YOUR_DB_USERNAME
spring.datasource.password=YOUR_DB_PASSWORD
spring.jpa.hibernate.ddl-auto=update

jwt.secret=YOUR_JWT_SECRET_KEY
jwt.expiration=86400000

aes.secret=YOUR_AES_SECRET_KEY
```

### 3. Run the Backend

```bash
cd backend

# Linux / macOS
./mvnw spring-boot:run

# Windows
mvnw.cmd spring-boot:run
```

API available at `http://localhost:8080`.

### 4. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at `http://localhost:5173`.

### 5. Production Build

```bash
# Backend
cd backend && ./mvnw clean package
java -jar target/*.jar

# Frontend
cd frontend && npm run build
# Output: dist/
```

### Docker (optional)

```bash
docker-compose up --build
```

---

## Security

- **JWT Authentication** — all protected endpoints require a valid signed JWT. The `JwtAuthFilter` validates the token on every request before it reaches any controller.
- **AES Credential Encryption** — Meroshare passwords are encrypted via `EncryptionUtil` before being persisted and decrypted only when authenticating with the Meroshare API.
- **Global Exception Handler** — `GlobalExceptionHandler` (`@RestControllerAdvice`) intercepts all application exceptions and returns structured error responses without exposing internal stack traces.
- **Protected Routes** — the frontend `ProtectedRoute` component guards all authenticated pages; users without a valid session are redirected to login automatically.

---

## Developer

**Prasant Bhattarai**
- Portfolio: [prasant-bhattarai.com.np](https://prasant-bhattarai.com.np)
- GitHub: [github.com/coprashant](https://github.com/coprashant)