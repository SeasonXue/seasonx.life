// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://seasonx.life',
	integrations: [mdx(), sitemap()],
	vite: {
		plugins: [tailwindcss()],
		// Allow giscus.app iframe to fetch /giscus-theme.css + /fonts/* in local dev
		// when PUBLIC_GISCUS_THEME_URL points at localhost.
		server: {
			headers: {
				'Access-Control-Allow-Origin': '*',
			},
		},
		preview: {
			headers: {
				'Access-Control-Allow-Origin': '*',
			},
		},
	},
	// 旧「归档」路径 → 照片墙
	redirects: {
		'/archive': '/photos',
	},
	markdown: {
		shikiConfig: {
			theme: 'min-light',
		},
	},
});
