#!/usr/bin/env node
/**
 * Re-compress Live Photo assets already committed under public/images/live/.
 *
 * Recompresses each <slug>/photo.jpg (sharp, mozjpeg) and <slug>/video.mp4
 * (ffmpeg, H.264) in place. Dimensions are preserved (photo keeps its width,
 * video keeps ≤ long-edge cap), so the matching src/data/live/<slug>.json stays
 * valid. A re-encode that would grow a file is skipped unless --force.
 *
 * Usage:
 *   pnpm live:compress                 # compress every slug
 *   pnpm live:compress --only <slug>   # just one slug
 *   pnpm live:compress --dry-run       # report only, write nothing
 *
 * Options:
 *   --only <slug>     Limit to one slug folder
 *   --quality <n>     Still JPEG quality 1-100 (default from lib/media)
 *   --crf <n>         Video x264 CRF, lower = larger (default from lib/media)
 *   --force           Replace even if the re-encode is larger
 *   --dry-run         Print plan + sizes, write nothing
 *   -h, --help        Show help
 */

import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	compressJpeg,
	DEFAULT_JPEG_QUALITY,
	DEFAULT_VIDEO_CRF,
	encodeVideo,
	fileSize,
	formatBytes,
} from './lib/media.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_LIVE = join(ROOT, 'public', 'images', 'live');

function die(msg, code = 1) {
	console.error(`error: ${msg}`);
	process.exit(code);
}

function parseArgs(argv) {
	const args = {
		only: null,
		quality: DEFAULT_JPEG_QUALITY,
		crf: DEFAULT_VIDEO_CRF,
		force: false,
		dryRun: false,
		help: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '-h' || a === '--help') args.help = true;
		else if (a === '--force') args.force = true;
		else if (a === '--dry-run') args.dryRun = true;
		else if (a === '--only') args.only = argv[++i];
		else if (a === '--quality') args.quality = Number(argv[++i]);
		else if (a === '--crf') args.crf = Number(argv[++i]);
		else die(`Unknown option: ${a}`);
	}
	return args;
}

function printHelp() {
	console.log(`Usage: pnpm live:compress [options]

Re-compress committed Live Photo assets under public/images/live/.

  --only <slug>     Limit to one slug folder
  --quality <n>     Still JPEG quality 1-100 (default ${DEFAULT_JPEG_QUALITY})
  --crf <n>         Video x264 CRF, lower = larger (default ${DEFAULT_VIDEO_CRF})
  --force           Replace even if the re-encode is larger
  --dry-run         Print plan + sizes, write nothing
  -h, --help        Show help
`);
}

function listSlugs() {
	if (!existsSync(PUBLIC_LIVE)) return [];
	return readdirSync(PUBLIC_LIVE, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort();
}

function pct(before, after) {
	if (!before) return '0%';
	return `${(((before - after) / before) * 100).toFixed(0)}%`;
}

async function processFile(kind, srcPath, encode, { dryRun, force }) {
	if (!existsSync(srcPath)) return { before: 0, after: 0, skipped: true };
	const before = fileSize(srcPath);

	if (dryRun) {
		console.log(`    ${kind}: ${formatBytes(before)} (dry-run, unchanged)`);
		return { before, after: before, skipped: true };
	}

	// Keep the real extension so ffmpeg/sharp can infer the output format.
	const tmp = `${srcPath}.tmp${extname(srcPath)}`;
	try {
		await encode(srcPath, tmp);
	} catch (e) {
		rmSync(tmp, { force: true });
		throw e;
	}
	const after = statSync(tmp).size;

	if (after >= before && !force) {
		rmSync(tmp, { force: true });
		console.log(`    ${kind}: ${formatBytes(before)} → kept (re-encode ${formatBytes(after)} not smaller)`);
		return { before, after: before, skipped: true };
	}

	renameSync(tmp, srcPath);
	console.log(
		`    ${kind}: ${formatBytes(before)} → ${formatBytes(after)}  (-${pct(before, after)})`,
	);
	return { before, after, skipped: false };
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		process.exit(0);
	}

	let slugs = listSlugs();
	if (args.only) {
		if (!slugs.includes(args.only)) die(`slug not found: ${args.only}`);
		slugs = [args.only];
	}
	if (slugs.length === 0) {
		console.log('No Live Photo assets found under public/images/live/.');
		return;
	}

	console.log(`Compressing ${slugs.length} Live Photo asset(s)${args.dryRun ? ' (dry-run)' : ''}`);
	console.log(`  jpeg quality ${args.quality} · video crf ${args.crf}\n`);

	let totalBefore = 0;
	let totalAfter = 0;

	for (const slug of slugs) {
		const dir = join(PUBLIC_LIVE, slug);
		console.log(`  ${slug}`);

		const photo = await processFile(
			'photo.jpg',
			join(dir, 'photo.jpg'),
			(src, out) => compressJpeg(src, out, { quality: args.quality }),
			args,
		);
		const video = await processFile(
			'video.mp4',
			join(dir, 'video.mp4'),
			(src, out) => Promise.resolve(encodeVideo(src, out, { crf: args.crf })),
			args,
		);

		totalBefore += photo.before + video.before;
		totalAfter += photo.after + video.after;
	}

	console.log('');
	console.log(
		`done. total ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}  (-${pct(totalBefore, totalAfter)})`,
	);
	if (args.dryRun) console.log('(dry-run: no files written)');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
