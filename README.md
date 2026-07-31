# PayFlow — Payments Processing System

An end-to-end Payments Processing training project: a Spring Boot REST API
backed by MySQL, with a polished vanilla-JS "UPI style" frontend supporting
**UPI**, **Card** and **Net Banking** payments, full status-lifecycle
tracking, an audit trail, idempotent creation, and Dockerized deployment.

```
backend (1)/
├── backend/           Spring Boot 3 REST API (Java 17, Maven, MySQL, JUnit 5)
├── frontend/           Static HTML/CSS/JS UPI-style dashboard (no build step)
├── docker-compose.yml  MySQL + backend containers
└── README.md
```

## 1. Payment Lifecycle

```
CREATED → VALIDATED → SENT → COMPLETED
      ↘        ↘        ↘
       FAILED (can occur at any stage, terminal)
```

Every transition is validated against a state machine
(`PaymentStateMachine`) and recorded in `payment_status_history` with a
timestamp and the actor that triggered it (`USER` or `SIMULATOR`).

After a payment is created, `PaymentSimulationService` asynchronously
progresses it through the lifecycle (simulating a real payment network)
with random delays and a configurable random failure rate — no real payment
gateway integration is used, per the project brief.

## 2. Tech Stack

| Layer     | Technology |
|-----------|------------|
| Backend   | Java 17, Spring Boot 3.3, Spring Web, Spring Data JPA, Bean Validation |
| Database  | MySQL 8 (root / `n3u3da!`, schema `payments_db`) |
| Docs      | springdoc-openapi (Swagger UI) |
| Testing   | JUnit 5, Mockito, MockMvc, AssertJ, H2 (in-memory, test-only) |
| Frontend  | Vanilla HTML/CSS/JS (no build tooling required) |
| Deployment| Docker + Docker Compose |

## 3. Data Model

**`payments`**
`id (UUID)`, `idempotency_key (unique)`, `amount`, `currency`,
`source_account`, `destination_account`, `payment_method [UPI|CARD|NETBANKING]`,
`status [CREATED|VALIDATED|SENT|COMPLETED|FAILED]`, `reference`,
method-specific fields (`upi_id` / `card_number_masked, card_holder_name,
card_expiry, card_network` / `bank_name, bank_account_type`), `error_code`,
`error_message`, `version` (optimistic locking), `created_at`, `updated_at`.

**`payment_status_history`**
`id`, `payment_id (FK)`, `from_status`, `to_status`, `triggered_by`, `notes`,
`changed_at`.

See `backend/src/main/resources/db/init.sql` for the reference DDL (Hibernate
also auto-creates/updates these tables via `ddl-auto=update`).

## 4. REST API

Base path: `/api/payments`

| Method | Path                       | Description |
|--------|----------------------------|--------------|
| POST   | `/api/payments`            | Create a payment (idempotent via `idempotencyKey`) |
| GET    | `/api/payments/{id}`       | Get a single payment |
| GET    | `/api/payments`            | List/search/filter payments (`status`, `search`, `page`, `size`, `sortBy`, `direction`) |
| GET    | `/api/payments/{id}/history` | Full status-transition audit trail |
| PATCH  | `/api/payments/{id}/status` | Manually transition status (validated against the state machine) |

Swagger UI (when the backend is running): **http://localhost:8080/swagger-ui.html**
OpenAPI JSON: **http://localhost:8080/v3/api-docs**

### Error Codes

| Error Code | HTTP Status | Meaning |
|---|---|---|
| VALIDATION_FAILED | 400 | Bean-validation failure |
| INVALID_AMOUNT | 400 | Amount ≤ 0, > 1,000,000, or > 2 decimal places |
| INVALID_CURRENCY | 400 | Unsupported ISO 4217 code |
| INVALID_ACCOUNT | 400 | Missing / identical source & destination accounts |
| INVALID_PAYMENT_METHOD | 400 | Missing/invalid UPI, Card or NetBanking details |
| DUPLICATE_PAYMENT | 409 | Idempotency key already exists (returns existing payment instead) |
| INVALID_STATUS_TRANSITION | 400 | Illegal state-machine transition |
| PAYMENT_NOT_FOUND | 404 | Unknown payment id |
| PROCESSING_ERROR | 500 | Unexpected server error / simulated processing failure |
| NETWORK_ERROR | 503 | Simulated network failure while sending payment |

## 5. Running Locally (no Docker)

> ⚠️ **Important:** Lombok's annotation processor currently does not support
> bleeding-edge JDKs (e.g. JDK 25). Build/run the backend with **JDK 17**
> even if a newer JDK is your machine default.

### 5.1 MySQL

Make sure MySQL is running locally with user `root` / password `n3u3da!`.
The schema `payments_db` is created automatically
(`createDatabaseIfNotExist=true`), or you can run
`backend/src/main/resources/db/init.sql` manually.

### 5.2 Backend

```powershell
cd "backend (1)/backend"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
.\mvnw.cmd spring-boot:run
```

The API starts on **http://localhost:8080**.

### 5.3 Frontend

The frontend is plain static files — serve them with any static server
(opening `index.html` directly via `file://` can trigger browser CORS/fetch
restrictions, so a local server is recommended):

```powershell
cd "backend (1)/frontend"
./serve.ps1
```

Then open **http://localhost:5500**. The dashboard will show "API Connected"
once it can reach the backend. The API base URL is configurable in
`frontend/js/config.js`.

## 6. Running with Docker

```powershell
cd "backend (1)"
docker compose up --build
```

This starts:
- `payments-mysql` — MySQL 8.3, database `payments_db`, root password `n3u3da!`
- `payments-backend` — the Spring Boot API on port 8080 (waits for MySQL health check)

Then serve `frontend/` separately (e.g. `./frontend/serve.ps1`) pointed at
`http://localhost:8080`.

## 7. Testing

```powershell
cd "backend (1)/backend"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"; $env:Path = "$env:JAVA_HOME\bin;" + $env:Path
.\mvnw.cmd test
```

Tests use an in-memory H2 database (`src/test/resources/application.properties`)
so no live MySQL is required. Coverage includes:
- `PaymentStateMachineTest` — every valid/invalid lifecycle transition
- `PaymentValidationServiceTest` — amount/currency/account/method validation rules
- `PaymentServiceTest` — idempotent create, status updates, error handling (Mockito)
- `PaymentControllerTest` — HTTP status codes & error payloads (MockMvc)

## 8. Key Design Decisions

- **Idempotency**: an optional client-supplied `idempotencyKey` is unique in
  the DB; a repeat request with the same key returns the *existing* payment
  (HTTP 201) rather than creating a duplicate or erroring.
- **State machine**: `PaymentStateMachine` centralises the allowed
  transitions so invalid jumps (e.g. `COMPLETED → CREATED`) are rejected
  everywhere consistently (manual API calls and the internal simulator).
- **Audit trail**: every transition — including the initial `CREATED` entry
  — is persisted with `triggeredBy` (`USER` or `SIMULATOR`) and free-text
  `notes`, satisfying the compliance/debugging requirement.
- **Optimistic locking**: `@Version` on `Payment` guards against concurrent
  status updates.
- **Simulation**: `PaymentSimulationService` runs asynchronously
  (`@Async`) after creation, advancing the payment through the lifecycle with
  randomized delay/failure to emulate a real downstream network without any
  external integration.

