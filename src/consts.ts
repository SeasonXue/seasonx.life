// 站点全局配置 — 部署前请按需修改

export const SITE_TITLE = 'SeasonX';
export const SITE_DESCRIPTION = '个人博客 · 技术、思考与生活';
export const SITE_AUTHOR = 'SeasonX';
export const SITE_URL = 'https://seasonx.life';
export const SITE_LANG = 'zh-CN';

/** 社交链接（留空则不显示对应图标） */
export const SOCIAL_LINKS = {
	github: 'https://github.com/seasonx',
	twitter: '',
	email: '',
} as const;

/**
 * Giscus 评论配置
 * 1. 仓库开启 Discussions
 * 2. 访问 https://giscus.app/zh 生成配置
 * 3. 填入下方字段；repo 为空时不渲染评论组件
 */
export const GISCUS = {
	repo: 'SeasonXue/seasonx.life',
	repoId: 'R_kgDOTxOgcA',
	category: 'Announcements',
	categoryId: 'DIC_kwDOTxOgcM4DC32b',
	mapping: 'pathname' as const,
	reactionsEnabled: '1' as const,
	emitMetadata: '0' as const,
	inputPosition: 'bottom' as const,
	lang: 'zh-CN' as const,
	loading: 'lazy' as const,
};

/**
 * Cloudflare Web Analytics（可选）
 *
 * 优先读取构建时环境变量 `PUBLIC_CF_ANALYTICS_TOKEN`
 * （本地 `.env` / GitHub Actions secret / CI 环境变量）。
 * 留空则不注入统计脚本。
 *
 * 获取：Cloudflare 仪表盘 → Web Analytics → 添加/管理站点 → JS snippet 中的 token
 */
export const CF_ANALYTICS_TOKEN =
	(import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN as string | undefined)?.trim() || '';
