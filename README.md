# GameHub Core Monorepo

Unified campus sports, matchmaking, and reservation portal structured as a Hexagonal (Ports & Adapters) modular monolith.

---

## 1. Project Layout & Architecture

The application is organized under a single NestJS monorepo, separating features into decoupled module boundaries inside the `backend/src/modules/` directory.

### Core Modules
* **Identity**: Manages user profiles, team roster mutations, and dual-token authentication.
* **Facilities**: Coordinates physical/virtual play area structures, schedules, and timeslot reservations.
* **Matchmaking**: Coordinates player queues via Redis, manages matchmaking tickets, and handles websocket presence.
* **Matches**: Implements match states, rules validation, and score sheets.
* **Progression**: Controls ELO ranking calculation, ELO ledger traces, and leaderboards.
* **Tournaments**: Automates bracket tree propagation for single/double-elimination and round-robin events.
* **Moderation & Social**: Manages chat channels, report tickets, dispute resolution, and sanction cascades.

```
backend/src/
├── main.ts                          # Node SDK / NestJS Application Entrypoint
├── shared/
│   ├── events/                      # Shared event bus dispatcher adapter
│   ├── filters/                     # Global exception filtering and serialization
│   └── telemetry/                   # OpenTelemetry bootstrap hooks and manual metrics
└── modules/
    ├── identity/                    # Core profile data & credentials domain
    ├── facilities/                  # Reservations & play areas module
    ├── matchmaking/                 # Matchmaking ticket ingest/egress and websocket gateway
    ├── matches/                     # In-progress match logs & score validation
    ├── progression/                 # Elo calculations & immutable ledgers
    ├── tournaments/                 # Brackets engine and standings processors
    └── moderation/                  # Chat moderation, report queues, and sanction enforcer
```

### Dependency Inversion Symbols & Ports
To maintain modular boundaries and strictly forbid direct cross-module database imports, services communicate across module borders using NestJS dependency injection tokens.

| Injection Token | Interface / Port | Target Module Provider |
| :--- | :--- | :--- |
| `IUserRepositoryPortToken` | `IUserRepositoryPort` | Identity Persistence Adapter |
| `ITeamRepositoryPortToken` | `ITeamRepositoryPort` | Identity Persistence Adapter |
| `IPlayAreaRepositoryPortToken` | `IPlayAreaRepositoryPort` | Facilities Persistence Adapter |
| `IPlayAreaReservationRepositoryPortToken` | `IPlayAreaReservationRepositoryPort` | Facilities Persistence Adapter |
| `ITicketRepositoryPortToken` | `ITicketRepositoryPort` | Matchmaking Redis/DB Adapter |
| `IDeviceTokenRepositoryPortToken` | `IDeviceTokenRepositoryPort` | Matchmaking Persistence Adapter |
| `INotificationServicePortToken` | `INotificationServicePort` | Matchmaking Notification Adapter |
| `IReservationUseCaseToken` | `IReservationUseCase` | Facilities Core Service |
| `ITeamManagementUseCaseToken` | `ITeamManagementUseCase` | Identity Core Service |
| `IAuthenticationUseCaseToken` | `IAuthenticationUseCase` | Identity Core Service |

---

## 2. Concurrency & Optimistic Concurrency Control (OCC)

To prevent resource contention (e.g. two groups booking a physical foosball table for the same timeslot), the scheduling engine employs a dual concurrency guard:

### Serializable Transactions
All reservation allocations and ELO calculation routines execute under a `SERIALIZABLE` transaction isolation level. This blocks phantom reads and ensures chronological serialization of race conditions.

### Version-Column OCC
The `PlayArea` entity maps a `@VersionColumn()` field tracking structural state updates. 
```typescript
@Entity('play_areas')
export class PlayAreaEntity {
  @VersionColumn()
  version: number;
}
```

### "Matched but Homeless" Recovery Loop
During matchmaking pair allocation, if another process books the selected play area first, a collision triggers an `OptimisticLockException`. The recovery loop intercepts the failure:
1. **Intercept & Rollback**: Aborts the active SQL transaction.
2. **Re-Queue with Score 0**: Re-injects both tickets back into the Redis Sorted Set (ZSET) queue with a score of `0`. This guarantees absolute priority at the front of the queue, bypassing standard age scores.
```
[Pair Formed] -> [Start Transaction] -> [Reserve Play Area (OCC Check)]
                      |
                      +---> [Success] ---> [Commit Match]
                      |
                      +---> [OptimisticLockException]
                                   |
                            [Rollback SQL]
                                   |
                     [Re-Queue Tickets (ZSET Score 0)]
```

---

## 3. Real-Time WebSocket Gateway & Disconnection Lifecycles

The real-time layer coordinates client presence and timeouts using a hybrid Redis-BullMQ architecture.

### Presence Tracking (`MatchGateway`)
* **Namespace**: Connected clients join the `/match` websocket namespace.
* **Heartbeat Ingest**: Every 5 seconds, clients emit a `heartbeat` frame. The gateway updates a volatile key in Redis:
  `SET gamehub:heartbeat:{userId} "active" EX 15`
* **Minimized Presence (App Backgrounding)**: When the client backgrounds the app, it emits `minimize_presence`. The gateway extends the TTL to accommodate longer connection loss:
  `EX 60`

### Disconnection Detection Loop
1. **Keyspace Expiry**: Redis is configured to broadcast expiry events: `notify-keyspace-events KEA`.
2. **Subscription Listener**: The `HeartbeatKeyspaceSubscriber` listens to the `__keyevent@0__:expired` channel.
3. **BullMQ Queue Ingestion**: When `gamehub:heartbeat:{userId}` expires, the subscriber pushes a timeout job into the `heartbeat-timeout-handler` queue.
4. **BullMQ Worker (`HeartbeatTimeoutProcessor`)**:
   * Transitions user status to `OFFLINE`.
   * Cancels active matchmaking tickets (`status = 'CANCELLED'`).
   * Forfeits active matches in progress (winner receives default score; forfeiter ELO drops).
   * Cancels upcoming play area bookings.
   * Dispatches high-priority silent push notification (`HEARTBEAT_EXPIRED`) to user devices.

---

## 4. Authentication and Hashing Security Matrix

Credentials and session distribution are segmented based on client request context.

### Token Delivery Channels
* **Standard Web Clients**: Access and Refresh tokens are written directly into secure, `HttpOnly`, `SameSite=Strict`, TLS-forced cookies to prevent XSS exfiltration.
* **Mobile Shells (WebKit / Capacitor)**: In environments where cookies are dropped, the controller detects user-agent headers and delivers tokens in the JSON response payload. The mobile client submits refresh requests via the custom `X-Refresh-Token` header.

### Cryptographic Argon2 PIN Verification
Dynamic kiosks and mobile clients utilize a 4-digit numerical PIN. Invariants are enforced at the domain boundary:
* **Validation Constraint**: Must match the regex `/^\d{4}$/`.
* **Argon2 Hashing**: Standard password hashes use Argon2id configurations. Verification and updates execute asynchronously to prevent main event-loop blocking:
  ```typescript
  // Hash
  this.pinHash = await argon2.hash(newPin);
  // Verify
  return await argon2.verify(this.pinHash, pin);
  ```

---

## 5. Observability and Prometheus Metrics Standard

Manual OpenTelemetry meters are registered inside `otel-bootstrap.ts` and track telemetry patterns natively:

| Metric Name | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `nodejs_eventloop_lag_seconds` | Gauge | `s` | Node.js Event Loop Lag delay (via native `perf_hooks` monitor) |
| `redis_command_latency_seconds` | Histogram | `s` | Redis command execution duration (intercepted via sendCommand proxy) |
| `db_pool_active_connections` | Gauge | Count | Count of active connections in the PostgreSQL/TypeORM database pool |

---

## 6. Developer Onboarding and Command Reference

### Local Installation
```bash
# Install root dependencies
npm install

# Initialize workspace sub-structures
cd backend
bash init-structure.sh
```

### Database Initialization
```bash
# Seed local schema to target Postgres instance
psql -h localhost -U postgres -d gamehub_db -f backend/schema.sql
```

### Running Tests
```bash
# Run unit and integration tests across all workspaces
npm run test

# Run tests with coverage
npm run test -- --coverage
```

### Running Locally
```bash
# Spin up NestJS backend in development hot-reload mode
npm run start:backend:dev
```
