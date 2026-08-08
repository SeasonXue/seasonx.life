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
