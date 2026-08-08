import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
			/** Live Photo slug from `src/data/live/<slug>.json` (e.g. `2026-03-30-094329`) */
			heroLive: z.string().optional(),
			tags: z.array(z.string()).default([]),
			category: z.string().optional(),
			draft: z.boolean().default(false),
		}),
});

export const collections = { blog };
