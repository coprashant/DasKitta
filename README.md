# DasKitta

A specialized platform for **NEPSE (Nepal Stock Exchange)** investors. DasKitta lets you manage multiple Meroshare accounts, automate IPO applications, and check allotment results from a single interface.

---

## Tech Stack

**Frontend**
- React.js (Vite)
- React Router
- Custom CSS with animations
- Axios

**Backend**
- Java 17
- Spring Boot 3
- Spring Security with JWT
- AES Encryption for credential storage

**Database**
- PostgreSQL
- Spring Data JPA

---

## Features

- User registration and login with JWT-based session management
- Add and manage multiple Meroshare accounts from one place
- Apply to open IPOs across all linked accounts simultaneously
- Dashboard overview of accounts and IPO activity
- IPO allotment result checker for all linked accounts
- Application history with status tracking
- AES-encrypted storage of Meroshare credentials
- Consistent API error handling via a global exception handler

---

## Project Structure

```
DasKitta
├── backend
│   ├── .env
│   ├── pom.xml
│   ├── mvnw / mvnw.cmd
│   └── src/main/java/com/meroshare/backend
│       ├── BackendApplication.java
│       ├── config
│       │   └── SecurityConfig.java
│       ├── controller
│       │   ├── AccountController.java
│       │   ├── AuthController.java
│       │   └── IpoController.java
│       ├── dto
│       │   ├── AuthResponse.java
│       │   ├── IpoApplicationResponse.java
│       │   ├── IpoApplyRequest.java
│       │   ├── IpoApplyResult.java
│       │   ├── LoginRequest.java
│       │   ├── MeroshareAccountRequest.java
│       │   ├── MeroshareAccountResponse.java
│       │   └── RegisterRequest.java
│       ├── entity
│       │   ├── AppUser.java
│       │   ├── IpoApplication.java
│       │   └── MeroshareAccount.java
│       ├── exception
│       │   └── GlobalExceptionHandler.java
│       ├── repository
│       │   ├── AppUserRepository.java
│       │   ├── IpoApplicationRepository.java
│       │   └── MeroshareAccountRepository.java
│       ├── security
│       │   ├── EncryptionUtil.java
│       │   ├── JwtAuthFilter.java
│       │   ├── JwtUtil.java
│       │   └── UserDetailsServiceImpl.java
│       └── service
│           ├── AuthService.java
│           ├── CdscHttpClient.java
│           ├── IpoService.java
│           ├── MeroshareAccountService.java
│           └── MeroshareApiService.java
│
└── frontend
    ├── index.html
    ├── vite.config.js
    └── src
        ├── App.jsx
        ├── main.jsx
        ├── api
        │   ├── client.js
        │   ├── auth.js
        │   ├── accounts.js
        │   └── ipo.js
        ├── components
        │   ├── Navbar.jsx / Navbar.css
        │   └── ProtectedRoute.jsx
        ├── context
        │   └── AuthContext.jsx
        └── pages
            ├── Home/
            ├── Auth/            (Login, Register)
            ├── Dashboard/
            ├── AddAccount/
            ├── IPOApply/
            ├── ResultChecker/
            └── History/
```

---

## Setup & Installation

### Prerequisites

- Java 17+
- Node.js 18+ and npm
- PostgreSQL 14+
- Maven (or use the included `mvnw` wrapper)

### 1. Database

Connect to your PostgreSQL instance and create the database:

```sql
CREATE DATABASE meroshare_db;
```

### 2. Backend Configuration

In `backend/src/main/resources/application.properties`, set the following:

```properties
# Server
server.port=8080

# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/meroshare_db
spring.datasource.username=YOUR_DB_USERNAME
spring.datasource.password=YOUR_DB_PASSWORD
spring.jpa.hibernate.ddl-auto=update

# JWT
jwt.secret=YOUR_JWT_SECRET_KEY
jwt.expiration=86400000

# AES Encryption
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

The API will be available at `http://localhost:8080`.

### 4. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 5. Production Build

**Backend:**
```bash
cd backend
./mvnw clean package
java -jar target/*.jar
```

**Frontend:**
```bash
cd frontend
npm run build
# Output is in the dist/ directory
```

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register a new user | No |
| POST | `/api/auth/login` | Login and receive JWT | No |
| GET | `/api/accounts` | List all Meroshare accounts | Yes |
| POST | `/api/accounts` | Add a Meroshare account | Yes |
| DELETE | `/api/accounts/{id}` | Remove a Meroshare account | Yes |
| GET | `/api/ipo/open` | Get currently open IPOs | Yes |
| POST | `/api/ipo/apply` | Apply for an IPO | Yes |
| GET | `/api/ipo/result` | Check allotment result | Yes |
| GET | `/api/ipo/history` | Get application history | Yes |

---

## Security Overview

**JWT Authentication**
All protected endpoints require a valid JSON Web Token. On successful login, the server issues a signed JWT. The `JwtAuthFilter` validates this token on every incoming request before it reaches any controller.

**AES Encryption for Credentials**
Meroshare account passwords are never stored in plaintext. `EncryptionUtil` encrypts credentials using AES before persisting them and decrypts them only when authenticating with the Meroshare API.

**Global Exception Handler**
`GlobalExceptionHandler` uses `@RestControllerAdvice` to intercept all application exceptions and return structured, consistent error responses — without exposing internal stack traces or server details.

**Protected Routes**
The frontend `ProtectedRoute` component guards all authenticated pages. Users without a valid session via `AuthContext` are redirected to login automatically.

---

## Developer

**Prasant Bhattarai**
- Portfolio: [prasant-bhattarai.com.np](https://prasant-bhattarai.com.np)
- GitHub: [github.com/coprashant](https://github.com/coprashant)