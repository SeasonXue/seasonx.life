import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

/** 已发布文章，按日期降序 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
	const posts = await getCollection('blog', ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function getAllTags(posts: BlogPost[]): Map<string, number> {
	const tags = new Map<string, number>();
	for (const post of posts) {
		for (const tag of post.data.tags) {
			tags.set(tag, (tags.get(tag) ?? 0) + 1);
		}
	}
	return new Map([...tags.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN')));
}

export function getAllCategories(posts: BlogPost[]): Map<string, number> {
	const categories = new Map<string, number>();
	for (const post of posts) {
		const cat = post.data.category;
		if (cat) {
			categories.set(cat, (categories.get(cat) ?? 0) + 1);
		}
	}
	return new Map([...categories.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN')));
}

export function getPostsByTag(posts: BlogPost[], tag: string): BlogPost[] {
	return posts.filter((p) => p.data.tags.includes(tag));
}

export function getPostsByCategory(posts: BlogPost[], category: string): BlogPost[] {
	return posts.filter((p) => p.data.category === category);
}

/** 按年份分组（年份降序） */
export function groupPostsByYear(posts: BlogPost[]): Map<number, BlogPost[]> {
	const groups = new Map<number, BlogPost[]>();
	for (const post of posts) {
		const year = post.data.pubDate.getFullYear();
		const list = groups.get(year) ?? [];
		list.push(post);
		groups.set(year, list);
	}
	return new Map([...groups.entries()].sort((a, b) => b[0] - a[0]));
}

export function slugify(text: string): string {
	return encodeURIComponent(text.trim().toLowerCase());
}

/** Related posts by shared category/tags; falls back to latest */
export function getRelatedPosts(
	posts: BlogPost[],
	current: BlogPost,
	limit = 4,
): BlogPost[] {
	const { category, tags } = current.data;
	const scored = posts
		.filter((p) => p.id !== current.id)
		.map((p) => {
			let score = 0;
			if (category && p.data.category === category) score += 3;
			for (const t of tags) {
				if (p.data.tags.includes(t)) score += 1;
			}
			return { p, score };
		})
		.filter((x) => x.score > 0)
		.sort(
			(a, b) =>
				b.score - a.score || b.p.data.pubDate.valueOf() - a.p.data.pubDate.valueOf(),
		)
		.slice(0, limit)
		.map((x) => x.p);

	if (scored.length > 0) return scored;
	return posts.filter((p) => p.id !== current.id).slice(0, Math.min(3, limit));
}
