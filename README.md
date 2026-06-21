# GameHub Core Monorepo

Unified campus sports, matchmaking, and reservation portal structured as a Hexagonal (Ports & Adapters) modular application utilizing npm workspaces.

---

## Directory Layout

```
/home/caue/GameHub/
├── .github/
│   └── workflows/
│       └── ci.yml                          # GitHub Actions workflow (build, lint, test, docker)
├── architecture/
│   ├── gamehub_architecture.pdf            # Compiled system architecture specification (57 pages)
│   ├── gamehub_architecture.tex            # LaTeX source for the architecture specification
│   └── gamehub_architecture_v3_fixed.md    # Markdown representation of the specification
├── backend/
│   ├── Dockerfile                          # Optimized multi-stage Docker build config
│   ├── init-structure.sh                   # Monolith sub-folder initializer script
│   ├── jest.config.js                      # Jest workspace unit-testing rules
│   ├── package.json                        # Backend workspace manifest & script definitions
│   ├── schema.sql                          # PostgreSQL schema (users, play_areas, reservations, tickets, teams, rosters)
│   └── src/
│       ├── main.ts                         # NestJS application bootstrap entrypoint
│       ├── shared/
│       │   └── telemetry/
│       │       ├── __tests__/
│       │       │   └── otel-bootstrap.spec.ts # Observability bootstrap validation test
│       │       └── otel-bootstrap.ts       # OpenTelemetry NodeSDK bootstrap configuration
│       └── modules/
│           ├── facilities/
│           │   └── domain/
│           │       └── models/
│           │           └── PlayArea.ts     # Decoupled PlayArea model supporting multiple games
│           ├── matchmaking/
│           │   └── domain/
│           │       └── models/
│           │           └── Match.ts        # Match model with optional reservation bindings
│           └── identity/
│               ├── identity.module.ts      # Identity NestJS module wiring ports to adapters
│               ├── domain/
│               │   ├── models/
│               │   │   ├── Team.ts         # OfficialTeam, TemporaryEventTeam, and TeamRoster models
│               │   │   └── User.ts         # User model containing PIN validations and anonymization
│               │   └── services/
│               │       ├── AuthenticationService.ts # Credentials validation & dual-token generation
│               │       ├── JwtHelper.ts    # Self-contained HMAC-SHA256 signature cryptographic helper
│               │       └── TeamManagementService.ts # Team creation and roster validation service
│               ├── ports/
│               │   ├── inbound/
│               │   │   ├── IAuthenticationUseCase.ts # Login and token refresh use case definitions
│               │   │   └── ITeamManagementUseCase.ts # Roster mutations and team creation definitions
│               │   └── outbound/
│               │       ├── ITeamRepositoryPort.ts # Outbound interface for team storage
│               │       └── IUserRepositoryPort.ts # Outbound interface for user storage
│               └── adapters/
│                   ├── persistence/
│                   │   ├── Team.entity.ts  # Database mapper representing teams
│                   │   ├── TeamRepository.ts # Outbound repository adapter implementing ITeamRepositoryPort
│                   │   ├── TeamRoster.entity.ts # Database mapper representing team memberships
│                   │   ├── User.entity.ts  # Database mapper representing user profiles
│                   │   └── UserRepository.ts # Outbound repository adapter implementing IUserRepositoryPort
│                   └── transport/
│                       ├── AuthController.ts # REST endpoints for /auth/login and /auth/refresh
│                       ├── TeamController.ts # REST endpoints for /teams/official, /teams/temporary, and rosters
│                       └── guards/
│                           ├── JwtAuthGuard.ts # Guards matching Bearer tokens
│                           ├── RolesGuard.ts # Guard checking custom route annotations
│                           └── roles.decorator.ts # Custom @Roles route decorator
├── jest.config.js                          # Root Jest configuration coordinating workspaces
├── package.json                            # Root monorepo manifest setting up npm workspaces
├── git-setup-deploy.sh                     # Setup staging and release verification script
├── LICENSE                                 # Project MIT License
└── AGENTS.md                               # Agent behavioral constraints and instructions
```

---

## Architectural Specifications

### 1. Dynamic Physical PlayAreas & Multi-Game Resource Mapping
- **Administrative Flexibility**: The count and type of physical play areas (e.g., billiard tables, foosball tables) are managed dynamically through DB entries rather than being hardcoded in application logic.
- **Relational Decoupling**: A linking table `play_area_supported_games` decouples the game types from physical play area structures. This allows a single physical asset (e.g., Billiard Table 01) to support multiple game types simultaneously (e.g., both `BOLA_8` and `SNOOKER`).
- **Conflict Booking Policy**: Reserving a timeslot for one game type automatically blocks all other supported game types on that specific physical table for the duration of that reserved window. This is enforced via composite slot uniqueness constraints inside `play_area_reservations`.

### 2. Transient Virtual Table Lifecycle
- **Zero Infrastructure Card Games**: Card games (`TRUCO`, `BURACO`) bypass physical table constraints.
- **Dynamic Initialization & Immediate Auto-Deletion**: Virtual play areas are created dynamically in-memory or transiently in database tables when a matchmaking pair is formed, and are programmatically deleted immediately upon match finalization.
- **Bypassing Bottlenecks**: Virtual matches bypass physical reservation lookups, scheduling locks, and Optimistic Concurrency Control (OCC) version verifications entirely, preventing scaling bottlenecks on card game matches.

### 3. Dual-Token Authentication Strategy & Mobile Fallback
- **4-Digit Numerical PIN**: Authentication is refactored from generic alphanumeric passwords to 4-digit numerical PINs (securely hashed and compared via PBKDF2/scrypt key derivation), optimizing authentication interfaces on dynamic kiosks and mobile containers.
- **Access Tokens**: Short-lived (15 minutes) JWTs signed via HMAC-SHA256 containing user metadata and explicit RBAC claims (`sub`, `roles`, `instituteId`, `courseId`).
- **Refresh Tokens**: Long-lived (7 days) session tokens. The authentication controller intercepts refresh tokens from either an incoming `HttpOnly` secure cookie or an explicit `X-Refresh-Token` request header to support WebKit mobile shells (Capacitor/iOS) where cookies are silently purged.
- **Access Control**: Guards `JwtAuthGuard` and `RolesGuard` retrieve claims and match route configurations configured by custom `@Roles(...)` decorators.

### 4. Automated CI/CD Pipeline
- **Monorepo Workflow**: Configured at `.github/workflows/ci.yml` to trigger on pushes and pull requests to `main`.
- **Validation**: Enforces sequential stages for dependency checking, linting, type-checking, and test suite execution.
- **Optimized Compilation**: Triggers a multi-stage Docker build (based on `backend/Dockerfile`) with optimized GitHub Actions caching (`cache-from: type=gha`, `cache-to: type=gha,mode=max`) to mitigate pipeline execution lag.

### 5. Facilities & Reservations (Phase 3)
- **Custom DI Tokens**:
  - `IPlayAreaRepositoryPortToken`: Maps `IPlayAreaRepositoryPort` to persistence repository adapter.
  - `IPlayAreaReservationRepositoryPortToken`: Maps `IPlayAreaReservationRepositoryPort` to persistence repository adapter.
  - `IReservationUseCaseToken`: Maps `IReservationUseCase` to core domain reservation service.
- **Reservation State Machine**:
  - Valid transitions: `CONFIRMED` -> `ACTIVE` -> `COMPLETED`.
  - Cancellation transitions: `CONFIRMED` / `ACTIVE` -> `CANCELLED`. Invalid state transitions throw exception.
- **Concurrency & Transaction Control**:
  - Overrides write paths to execute within `SERIALIZABLE` transaction isolation level.
  - Implements Optimistic Concurrency Control (OCC) via `@VersionColumn()` on `PlayArea` entity.
  - Allocation path throws custom `OptimisticLockException` if transaction fails to lock (affected count 0, database busy, or serialization failures).
- **Open API REST Endpoints (JwtAuthGuard-Protected)**:
  - `POST /reservations`: Create timeslot booking (enforces max 14-day limit, overlap conflicts, and OCC).
  - `POST /reservations/:id/activate`: Transitions reservation status to `ACTIVE`.
  - `POST /reservations/:id/complete`: Transitions reservation status to `COMPLETED`.
  - `POST /reservations/:id/cancel`: Transitions reservation status to `CANCELLED`.

---

## Developer Onboarding & Setup

### 1. Monorepo Setup
From the repository root, install dependencies across all workspaces:
```bash
npm install
```

### 2. Monorepo Directory Initialization
Initialize the backend monolith directories using the bootstrapping script:
```bash
cd backend
bash init-structure.sh
```

### 3. Database Seeding
Seed the PostgreSQL storage layouts with the schema definition:
```bash
psql -h localhost -U postgres -d gamehub_db -f backend/schema.sql
```

### 4. Testing
Run the workspace test suites via Jest:
```bash
# Run tests across all workspaces
npm run test

# Run tests on the backend workspace specifically
npm run test --workspace=backend
```

### 5. Running the Application
Run the backend application in development mode:
```bash
npm run start:backend:dev
```

### 6. Verifying Telemetry
Ensure the telemetry collector endpoint is configured in your environment:
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
```
During bootstrap, `otel-bootstrap.ts` instantiates the NodeSDK using gRPC trace and metric exporters, setting up trace hooks across all standard HTTP routing handlers.
