<div align="center">

# NexiBase

### Open-source full-stack CMS built with Next.js 16

**Plugin-based. Theme-ready. Community-first.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-MySQL-2D3748?style=flat-square&logo=prisma)](https://prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Live Demo](https://nexibase.com) · [Documentation](#documentation) · [Quick Start](#quick-start) · [Plugins](#plugin-system)

</div>

---

<div align="center">

| Light Mode | Dark Mode |
|:---:|:---:|
| ![NexiBase Light](docs/screenshots/homepage-light.png) | ![NexiBase Dark](docs/screenshots/homepage-dark.png) |

</div>

## What is NexiBase?

NexiBase is an open-source, self-hosted CMS platform for building community sites, e-commerce, corporate websites, and more — all from a single codebase.

Drop a plugin folder → auto-detected. Override CSS variables → new theme. Drag widgets → custom homepage. That's the idea.

> **NexiBase** = **Next.js** + **I** + **Base**
>
> *I*: Intelligence, Idea, Interface, Individual, Innovation

---

## Features

### 🧩 Plugin System
- **Folder-based** — Drop a folder in `src/plugins/`, auto-detected
- Each plugin gets its own Prisma schema, API routes, admin pages, widgets, and menus
- Enable/disable from admin dashboard
- Plugins as git submodules — version and update independently

### 🎨 Theme System
- CSS variable-based theme switching
- Server-side loaded (no flash of unstyled content)
- Custom themes via `custom.css` — no build step needed
- Dark/light mode with system preference detection

### 📦 Widget System
- 12-column grid homepage layout
- Drag & drop widget placement (top / center / bottom zones)
- Sidebar widgets (left / right, all pages)
- Plugin widgets auto-registered

### 📋 Board System (Built-in Plugin)
- Unlimited boards with custom permissions
- Rich text editor (Tiptap) with image drag & drop
- Comments, threaded replies, reactions
- Gallery view, secret posts, pinned notices
- Full-text search (MySQL FULLTEXT)
- File attachments with auto image processing (Sharp → WebP)

### 👥 Members
- Email/password + social login (Google, Naver, Kakao)
- Email verification
- Role-based access (user / moderator / admin)
- Browser session management

### ⚙️ Admin Dashboard
- Member management
- Board management
- Plugin management (enable/disable, slug customization)
- Menu management (header/footer, tree structure)
- Homepage widget layout
- Content pages (about, FAQ, etc.)
- Site settings (theme, layout, analytics)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19 |
| Styling | Tailwind CSS 4, shadcn/ui |
| Database | MySQL 8+ via Prisma ORM |
| Auth | NextAuth.js (JWT + session) |
| Editor | Tiptap (rich text) |
| Image | Sharp (resize, WebP) |

---

## Quick Start

### Requirements
- Node.js 18+
- MySQL 8.0+

### 1. Clone

```bash
git clone --recurse-submodules https://github.com/nexibase/nexibase.git
cd nexibase
```

### 2. Install

```bash
npm install
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env with your MySQL credentials
```

### 4. Database

```sql
CREATE DATABASE nexibase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
npx prisma db push
```

### 5. Run

```bash
npm run dev
```

Visit http://localhost:3000 — **first signup becomes admin automatically.**

---

## Plugin System

Plugins are self-contained folders in `src/plugins/`:

```
src/plugins/my-feature/
├── plugin.ts           # Plugin metadata
├── schema.prisma       # Database models
├── schema.user.prisma  # User model relations (auto-injected)
├── routes/             # Page components
├── api/                # API endpoints
├── admin/              # Admin pages & API
├── widgets/            # Homepage widgets
├── menus/              # Auto-registered menus
└── header-widget.tsx   # Header icon/widget
```

**Add a plugin:**

```bash
# As git submodule
git submodule add https://github.com/nexibase/plugin-shop.git src/plugins/shop

# Sync database
npx prisma db push

# Restart → auto-detected → enable in admin
npm run dev
```

### Available Plugins

| Plugin | Description | Status |
|--------|------------|--------|
| `boards` | Community boards, posts, comments | Built-in |
| `contents` | Content pages (about, FAQ) | Built-in |
| `policies` | Terms, privacy policy | Built-in |
| `shop` | E-commerce (products, cart, orders) | Submodule |

---

## Project Structure

```
src/
├── app/              # Core routes + auto-generated wrappers
├── plugins/          # Plugin system
│   ├── boards/       # Community (built-in)
│   ├── contents/     # Content pages (built-in)
│   ├── policies/     # Policies (built-in)
│   └── shop/         # E-commerce (submodule)
├── layouts/          # Layout system (Header, HomePage, Footer)
├── themes/           # Theme system (CSS variables)
├── widgets/          # Standalone widgets
├── components/       # Shared UI components
└── lib/              # Utilities
```

---

## Documentation

- [Plugin Development Guide](docs/superpowers/specs/2026-04-06-plugin-architecture-design.md)
- [Theme Customization](#theme-system)
- [Widget System](#widget-system)

---

## Social Login Setup

<details>
<summary>Google</summary>

1. [Google Cloud Console](https://console.cloud.google.com/) → Create project
2. APIs & Services → Credentials → OAuth 2.0 Client ID
3. Redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
</details>

<details>
<summary>Naver</summary>

1. [Naver Developers](https://developers.naver.com/) → Register app
2. Service URL: `http://localhost:3000`
3. Callback URL: `http://localhost:3000/api/auth/callback/naver`
4. Set `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET` in `.env`
</details>

<details>
<summary>Kakao</summary>

1. [Kakao Developers](https://developers.kakao.com/) → Add app
2. Enable Kakao Login → Redirect URI: `http://localhost:3000/api/auth/callback/kakao`
3. Set email as required in consent items
4. Set `KAKAO_CLIENT_ID` (REST API key) and `KAKAO_CLIENT_SECRET` in `.env`
</details>

---

## Contributing

Contributions welcome! Open an issue, submit a PR, or just say hi.

---

## License

[MIT](LICENSE)

---

<div align="center">

**[nexibase.com](https://nexibase.com)** · **[GitHub](https://github.com/nexibase/nexibase)**

</div>
