# CLAUDE.md

This file provides guidance for AI assistants (Claude and others) working in this repository.

## Project Overview

> **Status:** This is a freshly initialized repository with no source code yet.
> Update this section once the project purpose, language, and framework are established.

**Project name:** fantastic-potato
**Purpose:** TBD
**Primary language:** TBD
**Framework(s):** TBD

---

## Repository Structure

> Update this section as directories and files are added.

```
fantastic-potato/
├── CLAUDE.md          # This file — AI assistant guidance
└── (project files TBD)
```

Recommended layout conventions to follow when adding code:

- `src/` — application source code
- `tests/` — test files mirroring the `src/` structure
- `docs/` — documentation
- `scripts/` — utility and automation scripts
- `.github/workflows/` — CI/CD pipelines

---

## Development Setup

> Fill in once the stack is chosen.

```bash
# Example — replace with actual setup commands
# Install dependencies
# npm install  /  pip install -r requirements.txt  /  cargo build

# Copy environment template
# cp .env.example .env
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| *(none yet)* | — | — |

Add a `.env.example` file listing all required variables (without values) when env vars are introduced.

---

## Build & Run

> Fill in once a build system is configured.

```bash
# Build
# npm run build  /  make build  /  cargo build --release

# Run locally
# npm start  /  python -m myapp  /  ./target/release/app
```

---

## Testing

> Fill in once a test framework is configured.

```bash
# Run all tests
# npm test  /  pytest  /  cargo test  /  go test ./...

# Run a single test file
# npm test -- path/to/test  /  pytest tests/test_foo.py
```

**AI assistants must run tests before committing** when a test suite exists. Do not commit code that breaks existing tests.

---

## Linting & Formatting

> Fill in once tools are configured.

```bash
# Lint
# npm run lint  /  flake8 .  /  cargo clippy

# Format
# npm run format  /  black .  /  cargo fmt
```

Always run linting and formatting before committing. Fix all errors; address warnings where reasonable.

---

## Git Workflow

### Branch naming

- Feature branches: `feature/<short-description>`
- Bug fixes: `fix/<short-description>`
- Documentation: `docs/<short-description>`
- AI-driven changes: `claude/<short-description>-<session-id>`

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>

[optional body]
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`

Examples:
```
feat(auth): add JWT token refresh
fix(api): handle null response from upstream
docs: update CLAUDE.md with test commands
```

### Pull requests

- Open a PR for every change — do not push directly to `main` or `master`.
- Include a description of what changed and why.
- Ensure CI passes before requesting review.

---

## AI Assistant Guidelines

Rules for Claude and other AI assistants working in this repository:

### General

1. **Read before editing.** Always read a file fully before modifying it. Never guess at content.
2. **Minimal changes.** Only make changes directly requested or clearly necessary. Avoid refactoring, adding comments, or "improving" unrelated code.
3. **No speculative abstractions.** Do not create helpers, utilities, or design patterns for hypothetical future needs.
4. **No backwards-compat shims.** If something is removed, delete it entirely. Do not leave stub re-exports or `// removed` comments.
5. **Prefer editing over creating.** Add to existing files rather than creating new ones unless a new file is genuinely required.

### Security

6. **No security vulnerabilities.** Never introduce command injection, XSS, SQL injection, or other OWASP Top 10 issues.
7. **Validate at boundaries only.** Trust internal code; only validate user input and external API responses.

### Workflow

8. **Run tests before committing** (once a test suite exists). Do not commit broken code.
9. **Run linting before committing** (once a linter is configured). Fix all errors.
10. **Use the branch specified in the task.** Never push to a different branch without explicit permission.
11. **Write descriptive commit messages** following the Conventional Commits format above.
12. **Update CLAUDE.md** whenever new conventions, tools, or workflows are established so future assistants have accurate context.

### This repository (empty state)

- When adding the first source files, populate the *Repository Structure*, *Development Setup*, *Build & Run*, *Testing*, and *Linting & Formatting* sections above.
- When adding the first dependencies, add a `.env.example` if env vars are needed and document them in the *Environment Variables* table.
- When configuring CI, document the pipeline and any required secrets.
