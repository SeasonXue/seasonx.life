# SeasonX · 个人博客

基于 **Astro** 的全静态个人博客：内容以 Markdown / MDX 存于 Git，部署到 **Cloudflare Workers（Static Assets）**，零服务器成本、高性能、SEO 友好。

## 特性

- 全静态 SSG（无服务端运行时）
- Content Collections 管理 Markdown / MDX
- Tailwind CSS + 暗黑模式
- 文章列表 / 详情 / 归档 / 标签 / 分类
- 封面图、摘要、阅读时间、目录（TOC）
- 代码高亮（Shiki 双主题）
- Pagefind 静态全文搜索
- Giscus 评论（GitHub Discussions）
- RSS、Sitemap、robots.txt
- SEO：title、description、Open Graph、Twitter Card、JSON-LD
- 可选 Cloudflare Web Analytics

## 技术栈

| 类别 | 方案 |
|------|------|
| 框架 | Astro（最新稳定版） |
| 内容 | Markdown + MDX + Content Collections |
| 样式 | Tailwind CSS v4 |
| 包管理 | pnpm |
| 部署 | Cloudflare Workers（Static Assets） |
| 搜索 | Pagefind |
| 评论 | Giscus |

## 快速开始

### 环境要求

- Node.js `>= 22.12`
- pnpm（推荐）

### 安装与本地开发

```bash
pnpm install
pnpm dev
```

浏览器打开 [http://localhost:4321](http://localhost:4321)。

### 构建与预览

```bash
pnpm build    # astro build + pagefind 索引
pnpm preview  # 本地预览 dist/
pnpm check    # 类型与 Astro 检查
```

## 项目结构

```text
├── public/                 # 静态资源、robots.txt
├── src/
│   ├── assets/             # 图片、字体
│   ├── components/         # Header、PostCard、TOC、Giscus 等
│   ├── content/blog/       # 文章（Markdown / MDX）
│   ├── content.config.ts   # Collection schema
│   ├── consts.ts           # 站点与 Giscus / 分析配置
│   ├── layouts/            # BaseLayout、BlogPost
│   ├── pages/              # 路由页面
│   ├── styles/global.css   # Tailwind + 主题
│   └── utils/              # 阅读时间、文章聚合
├── astro.config.mjs
└── package.json
```

## 写文章

在 `src/content/blog/` 新建 `.md` 或 `.mdx` 文件：

```markdown
---
title: '文章标题'
description: '用于列表与 SEO 的摘要'
pubDate: '2026-03-21'
updatedDate: '2026-03-22'   # 可选
heroImage: '../../assets/your-cover.jpg'  # 可选
tags: ['astro', '教程']
category: '技术'              # 可选
draft: false                  # true 时生产构建不输出
---

正文从这里开始……
```

### Frontmatter 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 标题 |
| `description` | string | 摘要 / meta description |
| `pubDate` | date | 发布日期 |
| `updatedDate` | date? | 更新日期 |
| `heroImage` | image? | 封面（相对路径） |
| `tags` | string[] | 标签，默认 `[]` |
| `category` | string? | 分类 |
| `draft` | boolean | 草稿，默认 `false` |

封面图可放在 `src/assets/`，通过 `astro:assets` 自动优化。

## 站点配置

编辑 `src/consts.ts`：

- `SITE_TITLE` / `SITE_DESCRIPTION` / `SITE_AUTHOR` / `SITE_URL`
- `SOCIAL_LINKS`（GitHub、Twitter、Email）
- `GISCUS`（评论，见下）
- Web Analytics：用环境变量 `PUBLIC_CF_ANALYTICS_TOKEN`（见下文）

并同步修改 `astro.config.mjs` 中的 `site` 与 `public/robots.txt` 中的 Sitemap 地址。

## 配置 Giscus 评论

1. 目标仓库开启 **Discussions**
2. 打开 [giscus.app](https://giscus.app/zh)，按提示生成配置
3. 将 `repo`、`repoId`、`category`、`categoryId` 填入 `src/consts.ts` 的 `GISCUS`
4. 未填写时不渲染评论区

## 配置 Cloudflare Web Analytics（可选）

手动嵌入 beacon（推荐与 CSP 一起使用，避免依赖自动注入）：

1. Cloudflare 仪表盘 → **Web Analytics** → 添加站点（主机名填 `seasonx.life`）
2. 复制 JS snippet 中的 **token**
3. 构建时通过环境变量 `PUBLIC_CF_ANALYTICS_TOKEN` 注入（会写进 HTML）：

| 环境 | 做法 |
|------|------|
| 生产 / Preview | Worker → **Settings → Variables**（Build environment variables）设置 `PUBLIC_CF_ANALYTICS_TOKEN` |
| 本地 | 复制 `.env.example` 为 `.env`，设置同名变量 |
| CI | 可选：GitHub Repository secret `PUBLIC_CF_ANALYTICS_TOKEN` |
| 临时 | `PUBLIC_CF_ANALYTICS_TOKEN=... pnpm build` |

留空则不注入统计脚本。Token 会出现在前端 HTML 中，属于站点公开标识，但仍建议用环境变量管理、不要提交 `.env`。

## 部署到 Cloudflare Workers

纯静态输出，**不需要** `@astrojs/cloudflare` adapter。仓库内 `wrangler.jsonc` 将 `dist/` 作为 Static Assets 托管；未知路径返回自定义 `404` 页（HTTP 404）。

使用 **Workers + Static Assets**；生产部署通过 **Workers Builds**（连接 Git）完成。

### Workers Builds（连接 Git）

1. 将代码推送到 GitHub
2. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → 导入仓库（创建 **Worker**，非 Pages）
3. 构建设置：

| 配置项 | 值 |
|--------|-----|
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Deploy command | `npx wrangler deploy` |
| Node.js version | `22`（Environment variables：`NODE_VERSION=22`） |
| 生产分支 | `main` |
| Build 环境变量 | 可选：`PUBLIC_CF_ANALYTICS_TOKEN`（见上文 Web Analytics） |

4. Save and Deploy

推送到 `main` 自动生产部署；PR 可获得 Preview URL。

### 本地 Wrangler

```bash
pnpm cf:dev         # build + wrangler dev
pnpm cf:deploy      # build + wrangler deploy
pnpm cf:deploy:dry  # 干跑，不上传
```

首次使用前执行一次：`npx wrangler login`。

### 自定义域名

Worker → **Settings → Domains & Routes** → 添加 `seasonx.life`（域名建议托管在 Cloudflare DNS）。

可选区域设置：

- 开启 **Always Use HTTPS**
- **关闭 Auto Minify**（JS/HTML/CSS），避免潜在前端兼容问题

### 缓存与安全头

`public/_headers` 会在构建后进入 `dist/`：

- 全局：`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy` 等
- **CSP**：允许本站资源、Bunny 字体、Giscus、Cloudflare Web Analytics、Pagefind Worker
- `/_astro/*`：长缓存 `immutable`（带 hash 的构建产物）
- `/pagefind/*`：日级缓存 + revalidate

若以后引入新的第三方脚本 / iframe，需同步更新 `public/_headers` 中的 `Content-Security-Policy`。

### CI

工作流：`.github/workflows/ci.yml`

| 触发 | 行为 |
|------|------|
| PR / push | `pnpm check` + `pnpm build` |

可选 Repository secret：`PUBLIC_CF_ANALYTICS_TOKEN`（构建时注入 analytics beacon）。

## 搜索说明

Pagefind 在 `pnpm build` 之后索引 `dist/`。开发模式（`pnpm dev`）下若无索引，搜索页会提示先构建；完整体验请 `pnpm build && pnpm preview`。

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 开发服务器 |
| `pnpm build` | 生产构建 + Pagefind |
| `pnpm preview` | 预览构建结果（Astro） |
| `pnpm check` | Astro / TypeScript 检查 |
| `pnpm cf:dev` | 构建后用 Wrangler 本地预览 |
| `pnpm cf:deploy` | 构建并部署到 Cloudflare Workers |

## 许可

按需自行添加。模板源自 [Astro Blog Starter](https://github.com/withastro/astro/tree/main/examples/blog)。
