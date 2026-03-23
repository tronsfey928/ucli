<h1 align="center">ucli Admin UI</h1>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61dafb" alt="React 18"/>
  <img src="https://img.shields.io/badge/Tailwind-v3-38bdf8" alt="Tailwind v3"/>
  <img src="https://img.shields.io/badge/i18n-EN%20%7C%20ZH-22c55e" alt="i18n"/>
  <img src="https://img.shields.io/badge/theme-light%20%7C%20dark-7c3aed" alt="theme"/>
</p>

---

The admin dashboard for `@tronsfey/ucli-server`. It is bundled into the server package and served at `/admin-ui`.

## Features

- **Groups** — create and delete group namespaces that isolate OAS entries and tokens
- **OAS Entries** — register OpenAPI services with encrypted auth configs (bearer / API key / basic / OAuth2 CC)
- **MCP Servers** — register MCP servers (http SSE or stdio subprocess) with encrypted auth configs
- **Tokens** — issue and revoke RS256 group JWTs; copy-on-issue flow
- **Internationalization** — English (default) and Simplified Chinese; persisted in `localStorage`
- **Dark / Light theme** — toggle in sidebar; persisted in `localStorage`

## Accessing the UI

Once the server is running, open:

```
http://localhost:3000/admin-ui
```

Enter your server URL and `ADMIN_SECRET` to connect.

---

## Screenshots

### Login & Dashboard

| Login | Dashboard (EN · Light) |
|-------|----------------------|
| ![Login](../../docs/screenshots/01-login.png) | ![Dashboard](../../docs/screenshots/02-dashboard.png) |

### Groups

| Groups list | New Group dialog |
|-------------|-----------------|
| ![Groups](../../docs/screenshots/03-groups.png) | ![New Group](../../docs/screenshots/04-groups-create.png) |

### OAS Entries

| OAS list | Edit OAS Entry |
|----------|---------------|
| ![OAS](../../docs/screenshots/05-oas.png) | ![Edit OAS](../../docs/screenshots/06-oas-edit.png) |

### MCP Servers

| MCP list | Add MCP Server |
|----------|---------------|
| ![MCP](../../docs/screenshots/07-mcp.png) | ![Add MCP](../../docs/screenshots/08-mcp-create.png) |

### Tokens

| Tokens list | Issue Token |
|-------------|-------------|
| ![Tokens](../../docs/screenshots/09-tokens.png) | ![Issue Token](../../docs/screenshots/10-tokens-issued.png) |

### Dark Mode

| Dashboard (Dark) | OAS Entries (Dark) |
|------------------|--------------------|
| ![Dashboard Dark](../../docs/screenshots/11-dashboard-dark.png) | ![OAS Dark](../../docs/screenshots/12-oas-dark.png) |

### Simplified Chinese (简体中文)

| Dashboard (中文) | MCP Servers (中文) |
|-----------------|-------------------|
| ![Dashboard ZH](../../docs/screenshots/13-dashboard-zh.png) | ![MCP ZH](../../docs/screenshots/14-mcp-zh.png) |

---

## Configuration

The UI is built and bundled into the server package. See [`packages/server/README.md`](../server/README.md) for full server configuration and deployment instructions.

### Build locally

```bash
# From repo root
pnpm --filter @tronsfey/ucli-admin build
```

The build output is in `packages/admin/dist/` and is automatically copied into the server package at publish time.
