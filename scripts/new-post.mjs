#!/usr/bin/env node
/**
 * Scaffold a new blog post under src/content/blog/.
 *
 * Usage:
 *   pnpm new:post "文章标题"
 *   pnpm new:post "Hello World" --slug hello --tags astro,教程 --category 技术
 *   pnpm new:post "草稿" --draft --mdx
 *
 * Options:
 *   --slug <name>           Filename slug (default: from title)
 *   --description <text>    Frontmatter description
 *   --date <YYYY-MM-DD>     pubDate (default: today, local)
 *   --tags <a,b,c>          Comma-separated tags
 *   --category <name>       Category
 *   --draft                 Mark as draft (default: true)
 *   --publish               draft: false
 *   --mdx                   Create .mdx instead of .md
 *   --force                 Overwrite if file exists
 *   --dry-run               Print path + content only
 *   -h, --help              Show help
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = join(ROOT, 'src', 'content', 'blog');

// ─── CLI ───────────────────────────────────────────────────────────────────

function printHelp() {
	console.log(`Usage: pnpm new:post <title> [options]

Create a Markdown/MDX post in src/content/blog/.

  --slug <name>           Filename slug (default: from title)
  --description <text>    Summary / SEO description
  --date <YYYY-MM-DD>     pubDate (default: today)
  --tags <a,b,c>          Comma-separated tags
  --category <name>       Category
  --draft                 draft: true (default)
  --publish               draft: false
  --mdx                   Use .mdx extension
  --force                 Overwrite existing file
  --dry-run               Print only
  -h, --help              Show help

Examples:
  pnpm new:post "我的第一篇文章"
  pnpm new:post "Astro Tips" --slug astro-tips --tags astro --category 技术 --publish
  pnpm new:post "实验" --mdx --draft
`);
}

function parseArgs(argv) {
	const args = {
		title: null,
		slug: null,
		description: null,
		date: null,
		tags: [],
		category: null,
		draft: true,
		mdx: false,
		force: false,
		dryRun: false,
		help: false,
	};

	const positionals = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '-h' || a === '--help') {
			args.help = true;
		} else if (a === '--slug') {
			args.slug = argv[++i];
		} else if (a === '--description') {
			args.description = argv[++i];
		} else if (a === '--date') {
			args.date = argv[++i];
		} else if (a === '--tags') {
			const raw = argv[++i] ?? '';
			args.tags = raw
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
		} else if (a === '--category') {
			args.category = argv[++i];
		} else if (a === '--draft') {
			args.draft = true;
		} else if (a === '--publish') {
			args.draft = false;
		} else if (a === '--mdx') {
			args.mdx = true;
		} else if (a === '--force') {
			args.force = true;
		} else if (a === '--dry-run') {
			args.dryRun = true;
		} else if (a.startsWith('-')) {
			fail(`Unknown option: ${a}`);
		} else {
			positionals.push(a);
		}
	}

	if (positionals.length > 0) {
		args.title = positionals.join(' ');
	}

	return args;
}

function fail(message) {
	console.error(`Error: ${message}`);
	process.exit(1);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Local calendar date as YYYY-MM-DD */
function todayLocal() {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/**
 * Build a URL-safe slug.
 * Keeps Latin letters, digits, CJK; collapses the rest to hyphens.
 */
function slugify(input) {
	const s = String(input)
		.trim()
		.normalize('NFKC')
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-+/g, '-');

	return s || 'post';
}

function isValidDate(value) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** YAML single-quoted string with proper escaping */
function yamlQuote(value) {
	return `'${String(value).replace(/'/g, "''")}'`;
}

function formatTags(tags) {
	if (!tags.length) return '[]';
	return `[${tags.map((t) => yamlQuote(t)).join(', ')}]`;
}

function uniquePath(dir, baseName, ext, force) {
	let file = `${baseName}${ext}`;
	let path = join(dir, file);
	if (!existsSync(path) || force) return { file, path };

	let n = 2;
	while (existsSync(join(dir, `${baseName}-${n}${ext}`))) n++;
	file = `${baseName}-${n}${ext}`;
	path = join(dir, file);
	return { file, path };
}

function buildContent({ title, description, date, tags, category, draft }) {
	const lines = [
		'---',
		`title: ${yamlQuote(title)}`,
		`description: ${yamlQuote(description ?? '')}`,
		`pubDate: ${yamlQuote(date)}`,
	];

	if (tags.length) lines.push(`tags: ${formatTags(tags)}`);
	else lines.push('tags: []');

	if (category) lines.push(`category: ${yamlQuote(category)}`);
	lines.push(`draft: ${draft}`);
	lines.push('---');
	lines.push('');
	lines.push('正文从这里开始……');
	lines.push('');

	return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
	const args = parseArgs(process.argv.slice(2));

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	if (!args.title?.trim()) {
		printHelp();
		fail('请提供文章标题，例如: pnpm new:post "我的文章"');
	}

	const title = args.title.trim();
	const date = args.date ?? todayLocal();
	if (!isValidDate(date)) {
		fail(`日期格式应为 YYYY-MM-DD，收到: ${date}`);
	}

	const slugPart = slugify(args.slug ?? title);
	const baseName = `${date}-${slugPart}`;
	const ext = args.mdx ? '.mdx' : '.md';

	mkdirSync(BLOG_DIR, { recursive: true });

	const { file, path } = uniquePath(BLOG_DIR, baseName, ext, args.force);
	if (existsSync(path) && !args.force) {
		// uniquePath already avoided collision unless force; this is overwrite case only
	}
	if (existsSync(path) && args.force) {
		// ok
	}

	const content = buildContent({
		title,
		description: args.description,
		date,
		tags: args.tags,
		category: args.category,
		draft: args.draft,
	});

	const rel = `src/content/blog/${file}`;

	if (args.dryRun) {
		console.log(`[dry-run] ${rel}\n`);
		console.log(content);
		return;
	}

	if (existsSync(path) && !args.force) {
		// Should not happen after uniquePath unless race; still guard
		fail(`文件已存在: ${rel}（使用 --force 覆盖）`);
	}

	writeFileSync(path, content, 'utf8');

	const urlSlug = file.replace(/\.(md|mdx)$/, '');
	console.log(`✓ 已创建 ${rel}`);
	console.log(`  草稿: ${args.draft ? '是' : '否'}`);
	console.log(`  预览: /blog/${urlSlug}`);
	console.log(`  编辑后运行: pnpm dev`);
}

main();
