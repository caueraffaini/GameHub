# GameHub Core Git Operational Manual

This wiki defines branching pathways, commit message semantics, and pre-push quality gates.

---

## 1. Git Flow and Branching Model

To coordinate modular monolith development, the repository follows a structured branch hierarchy. All development proceeds asynchronously through isolated pathways before integration.

### Core Branches
* **`main`**: The source of truth. Contains production-grade, compilable code. Direct pushes are disabled. All features integrate via Pull Requests.
* **`feature/`**: Temporary branches created for feature development.
  * **Naming Pattern**: `feature/{module-name}-{description}` (e.g. `feature/identity-argon2-pin`).
* **`release/`**: Temporary stabilization branches compiled prior to production releases.
  * **Naming Pattern**: `release/v{version}` (e.g. `release/v1.2.0`).

### Code Integration Pathway
```
  [main] --------+--------------------------+--------->
                  \                        / (PR merge)
                   +-- [feature/module] --+
```

1. **Checkout Feature**: Branch off `main`. Keep features small and scoped.
2. **Rebase Regularly**: Rebase the feature branch against `main` to resolve conflicts early.
3. **Open Pull Request**: Target `main`. Pull requests require green CI builds (build, lint, test) before manual approval.

---

## 2. Conventional Commits and Checklists

Commit headers must follow semantic specifications to auto-generate changelogs and trace changes accurately.

### Structure
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type Declarations
* **`feat`**: New application feature (e.g. `feat(matchmaking): implement redis zset queue`).
* **`fix`**: Bug fix (e.g. `fix(identity): handle async updatePin in tests`).
* **`refactor`**: Code change that neither fixes a bug nor adds a feature.
* **`test`**: Adding missing tests or correcting existing tests.
* **`docs`**: Documentation updates.
* **`chore`**: Maintenance tasks, library upgrades, configuration tweaks.

### Commit Quality Checklist
- [ ] **Subject Line length**: Stays under 50 characters.
- [ ] **Imperative Mood**: Written as a command (e.g. "implement" instead of "implemented").
- [ ] **Case & Punctuation**: Subject uses lowercase and contains no trailing period.
- [ ] **Scope Specified**: Scope points exactly to the affected module (e.g. `facilities`, `tournaments`).
- [ ] **Body Separated**: A single blank line separates the subject from the descriptive body.
- [ ] **Breaking Changes Footed**: Breaking mutations are documented in the footer prefixing `BREAKING CHANGE: <reason>`.

---

## 3. Pre-Flight Verification Gates

Before submitting a Pull Request or pushing code, developers must run verification gates locally to prevent pipeline blockages.

### Mandatory Execution Commands
Always execute these commands in sequence from the repository root:

```bash
# 1. Lint the codebase (enforces ESLint validation rules)
npm run lint

# 2. Run the full test suite (runs local mocks and Testcontainers PG tests)
npm run test

# 3. Compile the typescript code (verifies zero compiler errors)
npm run build
```

### Architecture PDF Regeneration
If changes are made to data models, websocket protocols, or flowcharts, the Compiled System Specification (`gamehub_architecture.pdf`) must be compiled from the LaTeX source.

```bash
# Compile LaTeX source to PDF locally
cd architecture
pdflatex gamehub_architecture.tex
```

---

## 4. Operational Best Practices
* **No Database Bypass**: Under no circumstance should a module direct-query a table belonging to another module.
* **Database Migrations**: Do not manually alter SQLite or Postgres engines. Write declarative SQL schema updates inside `backend/schema.sql` and verify structural alignment.
* **Telemetry Verification**: Ensure any new asynchronous path records command latencies to `redis_command_latency_seconds`.
