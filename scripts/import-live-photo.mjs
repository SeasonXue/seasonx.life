#!/usr/bin/env node
/**
 * Import an Apple Live Photo (HEIC/JPEG + MOV) into the site convention.
 *
 * Usage:
 *   pnpm live:import <still.HEIC|JPG> [video.MOV] [options]
 *
 * Options:
 *   --slug <name>           Output id (overrides --slug-from)
 *   --slug-from time|name   Default slug source (default: time = capture time)
 *                           time → YYYY-MM-DD-HHmmss (local capture time when available)
 *                           name → from still filename
 *   --alt <text>            Default alt text stored in meta (optional)
 *   --caption <text>        Default caption stored in meta (optional)
 *   --width <n>             Max still width in px (default: 1600)
 *   --video-max <n>         Max video long-edge in px (default: 1280)
 *   --no-geocode            Skip OpenStreetMap reverse geocode
 *   --force                 Overwrite existing output
 *   --dry-run               Print plan only
 *
 * Outputs:
 *   public/images/live/<slug>/photo.jpg
 *   public/images/live/<slug>/video.mp4
 *   src/data/live/<slug>.json   ← import this from Astro / MDX
 *
 * Requirements (macOS): sips, ffmpeg, ffprobe, mdls
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	compressJpeg,
	DEFAULT_JPEG_QUALITY,
	DEFAULT_VIDEO_CRF,
	encodeVideo,
} from './lib/media.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_LIVE = join(ROOT, 'public', 'images', 'live');
const DATA_LIVE = join(ROOT, 'src', 'data', 'live');

const DEFAULT_STILL_WIDTH = 1600;
const DEFAULT_VIDEO_MAX = 1280;

// ─── CLI ───────────────────────────────────────────────────────────────────

function printHelp() {
	console.log(`Usage: pnpm live:import <still> [video.MOV] [options]

Import Apple Live Photo into site folders + write importable meta JSON.

  --slug <name>           Output slug (overrides --slug-from)
  --slug-from time|name   Default slug: capture time (default) or still filename
  --alt <text>            Default alt in meta
  --caption <text>        Default caption in meta
  --width <n>             Max still width (default ${DEFAULT_STILL_WIDTH})
  --quality <n>           Still JPEG quality 1-100 (default ${DEFAULT_JPEG_QUALITY})
  --video-max <n>         Max video long edge (default ${DEFAULT_VIDEO_MAX})
  --video-crf <n>         Video x264 CRF, lower = larger (default ${DEFAULT_VIDEO_CRF})
  --no-geocode            Skip reverse geocode
  --force                 Overwrite existing
  --dry-run               Plan only
  -h, --help              Show help
`);
}

function parseArgs(argv) {
	const args = {
		still: null,
		video: null,
		slug: null,
		slugFrom: 'time',
		alt: null,
		caption: null,
		width: DEFAULT_STILL_WIDTH,
		quality: DEFAULT_JPEG_QUALITY,
		videoMax: DEFAULT_VIDEO_MAX,
		videoCrf: DEFAULT_VIDEO_CRF,
		geocode: true,
		force: false,
		dryRun: false,
		help: false,
	};

	const positionals = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '-h' || a === '--help') args.help = true;
		else if (a === '--force') args.force = true;
		else if (a === '--dry-run') args.dryRun = true;
		else if (a === '--no-geocode') args.geocode = false;
		else if (a === '--slug') args.slug = argv[++i];
		else if (a === '--slug-from') {
			const v = argv[++i];
			if (v !== 'time' && v !== 'name') die(`--slug-from must be "time" or "name", got "${v}"`);
			args.slugFrom = v;
		} else if (a === '--alt') args.alt = argv[++i];
		else if (a === '--caption') args.caption = argv[++i];
		else if (a === '--width') args.width = Number(argv[++i]);
		else if (a === '--quality') args.quality = Number(argv[++i]);
		else if (a === '--video-max') args.videoMax = Number(argv[++i]);
		else if (a === '--video-crf') args.videoCrf = Number(argv[++i]);
		else if (a.startsWith('-')) die(`Unknown option: ${a}`);
		else positionals.push(a);
	}

	args.still = positionals[0] ? resolve(positionals[0]) : null;
	args.video = positionals[1] ? resolve(positionals[1]) : null;
	return args;
}

function die(msg, code = 1) {
	console.error(`error: ${msg}`);
	process.exit(code);
}

// ─── shell helpers ─────────────────────────────────────────────────────────

function which(cmd) {
	const r = spawnSync('which', [cmd], { encoding: 'utf8' });
	return r.status === 0 ? r.stdout.trim() : null;
}

function run(cmd, args, opts = {}) {
	const r = spawnSync(cmd, args, {
		encoding: 'utf8',
		maxBuffer: 20 * 1024 * 1024,
		...opts,
	});
	if (r.status !== 0) {
		const err = (r.stderr || r.stdout || '').trim();
		die(`${cmd} ${args.join(' ')} failed${err ? `:\n${err}` : ''}`);
	}
	return r.stdout ?? '';
}

function runSoft(cmd, args) {
	const r = spawnSync(cmd, args, {
		encoding: 'utf8',
		maxBuffer: 10 * 1024 * 1024,
	});
	return r.status === 0 ? (r.stdout ?? '').trim() : '';
}

// ─── path / slug ───────────────────────────────────────────────────────────

function slugify(name) {
	return name
		.replace(/\.[^.]+$/, '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase() || 'live-photo';
}

/**
 * Build slug YYYY-MM-DD-HHmmss from a capture timestamp string.
 * Prefers local wall-clock when an offset is present (QuickTime creationdate).
 */
function formatCaptureSlug(raw) {
	if (!raw) return null;
	const s = String(raw).trim();

	// 2025-04-18T18:12:43+0800  |  2025-04-18T18:12:43+08:00  |  2025-04-18T10:12:44Z
	const iso = s.match(
		/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?/,
	);
	if (iso) {
		const [, Y, M, D, h, m, sec, tz] = iso;
		// If timezone is absolute UTC (Z) only, convert to local for folder naming.
		if (tz === 'Z' || tz === '+00:00' || tz === '+0000' || tz === '-00:00' || tz === '-0000') {
			const d = new Date(
				Date.UTC(Number(Y), Number(M) - 1, Number(D), Number(h), Number(m), Number(sec)),
			);
			return localDateSlug(d);
		}
		// Offset present or missing: use the wall-clock digits as shot on device.
		return `${Y}-${M}-${D}-${h}${m}${sec}`;
	}

	// mdls style without T: "2025-04-18 10:12:44 +0000"
	const mdls = s.match(
		/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4}|[+-]\d{2}:\d{2})/,
	);
	if (mdls) {
		const [, Y, M, D, h, m, sec, tz] = mdls;
		if (tz === '+0000' || tz === '-0000' || tz === '+00:00' || tz === '-00:00') {
			const d = new Date(
				Date.UTC(Number(Y), Number(M) - 1, Number(D), Number(h), Number(m), Number(sec)),
			);
			return localDateSlug(d);
		}
		return `${Y}-${M}-${D}-${h}${m}${sec}`;
	}

	const d = new Date(s);
	if (!Number.isNaN(d.getTime())) return localDateSlug(d);
	return null;
}

function localDateSlug(d) {
	const p = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Default slug: capture time (preferred) → still filename.
 * Capture order: QuickTime creationdate (local) → mdls ContentCreationDate.
 */
function resolveSlug({ stillPath, videoPath, explicit, slugFrom }) {
	if (explicit) return explicit;

	if (slugFrom === 'name') {
		return slugify(basename(stillPath));
	}

	// slugFrom === 'time'
	const videoMeta = extractFromVideo(videoPath);
	const stillMeta = extractFromStill(stillPath);
	const fromTime =
		formatCaptureSlug(videoMeta.capturedAt) || formatCaptureSlug(stillMeta.capturedAtUtc);
	if (fromTime) return fromTime;

	console.warn('warn: no capture time found; falling back to still filename for slug');
	return slugify(basename(stillPath));
}

function findCompanionVideo(stillPath) {
	const dir = dirname(stillPath);
	const base = basename(stillPath, extname(stillPath));
	const candidates = [
		join(dir, `${base}.MOV`),
		join(dir, `${base}.mov`),
		join(dir, `${base}.MP4`),
		join(dir, `${base}.mp4`),
	];
	return candidates.find((p) => existsSync(p)) ?? null;
}

// ─── media conversion ──────────────────────────────────────────────────────

async function convertStill(stillPath, outJpg, { maxWidth, quality }) {
	// sips decodes HEIC/JPEG to a full-size JPEG; sharp then resizes + compresses
	// (mozjpeg, progressive, metadata stripped) for a much smaller web asset.
	const tmp = `${outJpg}.full.jpg`;
	run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '100', stillPath, '--out', tmp]);
	const info = await compressJpeg(tmp, outJpg, { maxWidth, quality });
	rmSync(tmp, { force: true });
	return info;
}

function convertVideo(videoPath, outMp4, { maxEdge, crf }) {
	encodeVideo(videoPath, outMp4, { maxEdge, crf });
}

function probeVideo(mp4Path) {
	const raw = runSoft('ffprobe', [
		'-v',
		'error',
		'-show_entries',
		'format=duration:stream=codec_type,codec_name,width,height',
		'-of',
		'json',
		mp4Path,
	]);
	try {
		const j = JSON.parse(raw);
		const v = (j.streams || []).find((s) => s.codec_type === 'video');
		const a = (j.streams || []).find((s) => s.codec_type === 'audio');
		return {
			duration: j.format?.duration ? Number(j.format.duration) : null,
			width: v?.width ?? null,
			height: v?.height ?? null,
			hasAudio: Boolean(a),
		};
	} catch {
		return { duration: null, width: null, height: null, hasAudio: false };
	}
}

// ─── metadata extraction ───────────────────────────────────────────────────

function mdlsRaw(path, name) {
	const v = runSoft('mdls', ['-raw', '-name', name, path]);
	if (!v || v === '(null)') return null;
	return v;
}

function mdlsNumber(path, name) {
	const v = mdlsRaw(path, name);
	if (v == null) return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function parseIso6709(tag) {
	// e.g. "-08.4818+116.0369+002.014/"
	if (!tag) return null;
	const m = String(tag).match(
		/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)(?:([+-]\d+(?:\.\d+)?))?/,
	);
	if (!m) return null;
	return {
		latitude: Number(m[1]),
		longitude: Number(m[2]),
		altitude: m[3] != null ? Number(m[3]) : null,
	};
}

function extractFromStill(stillPath) {
	return {
		device: mdlsRaw(stillPath, 'kMDItemAcquisitionModel'),
		make: mdlsRaw(stillPath, 'kMDItemAcquisitionMake'),
		software: mdlsRaw(stillPath, 'kMDItemCreator'),
		capturedAtUtc: mdlsRaw(stillPath, 'kMDItemContentCreationDate'),
		latitude: mdlsNumber(stillPath, 'kMDItemLatitude'),
		longitude: mdlsNumber(stillPath, 'kMDItemLongitude'),
		altitude: mdlsNumber(stillPath, 'kMDItemAltitude'),
		imageDirection: mdlsNumber(stillPath, 'kMDItemImageDirection'),
	};
}

function extractFromVideo(videoPath) {
	const raw = runSoft('ffprobe', [
		'-v',
		'quiet',
		'-print_format',
		'json',
		'-show_format',
		videoPath,
	]);
	let tags = {};
	try {
		tags = JSON.parse(raw)?.format?.tags ?? {};
	} catch {
		tags = {};
	}

	const iso = tags['com.apple.quicktime.location.ISO6709'] ?? null;
	const parsed = parseIso6709(iso);
	const accuracy = tags['com.apple.quicktime.location.accuracy.horizontal'];

	return {
		tags,
		iso6709: iso,
		latitude: parsed?.latitude ?? null,
		longitude: parsed?.longitude ?? null,
		altitude: parsed?.altitude ?? null,
		horizontalAccuracy: accuracy != null ? Number(accuracy) : null,
		device: tags['com.apple.quicktime.model'] ?? null,
		software: tags['com.apple.quicktime.software'] ?? null,
		capturedAt: tags['com.apple.quicktime.creationdate'] ?? null,
		contentId: tags['com.apple.quicktime.content.identifier'] ?? null,
	};
}

function buildPlaceLabel(address) {
	if (!address || typeof address !== 'object') return null;
	// Prefer original OSM fields — do not translate.
	const parts = [
		address.tourism,
		address.village || address.town || address.city || address.hamlet || address.municipality,
		address.county || address.region,
		address.state,
		address.country,
	].filter(Boolean);
	// de-dupe consecutive
	const out = [];
	for (const p of parts) {
		if (out[out.length - 1] !== p) out.push(p);
	}
	return out.length ? out.join(', ') : null;
}

async function reverseGeocode(lat, lon) {
	const url = new URL('https://nominatim.openstreetmap.org/reverse');
	url.searchParams.set('lat', String(lat));
	url.searchParams.set('lon', String(lon));
	url.searchParams.set('format', 'json');
	// No accept-language override — keep source place names as returned.
	const ua = 'seasonx.life-live-import/1.0 (personal blog; local script)';

	let data = null;
	try {
		const res = await fetch(url, { headers: { 'User-Agent': ua } });
		if (res.ok) data = await res.json();
		else console.warn(`warn: reverse geocode HTTP ${res.status}`);
	} catch (e) {
		// Fallback: curl (some environments block undici fetch)
		const raw = runSoft('curl', [
			'-fsSL',
			'-A',
			ua,
			'--max-time',
			'15',
			url.toString(),
		]);
		if (raw) {
			try {
				data = JSON.parse(raw);
			} catch {
				console.warn(`warn: reverse geocode parse failed: ${e?.message || e}`);
			}
		} else {
			console.warn(`warn: reverse geocode failed: ${e?.message || e}`);
		}
	}
	if (!data) return null;

	const address = data.address ?? {};
	const name =
		address.village ||
		address.town ||
		address.city ||
		address.hamlet ||
		address.tourism ||
		null;

	return {
		name,
		region: address.county || address.region || null,
		state: address.state || null,
		country: address.country || null,
		countryCode: address.country_code ? String(address.country_code).toUpperCase() : null,
		road: address.road || null,
		label: buildPlaceLabel(address) || data.display_name || null,
		displayName: data.display_name || null,
		address,
	};
}

function mapsLinks(lat, lon, label) {
	const q = label ? encodeURIComponent(label) : '';
	const ll = `${lat},${lon}`;
	return {
		apple: `https://maps.apple.com/?ll=${ll}${q ? `&q=${q}` : ''}`,
		google: `https://www.google.com/maps?q=${ll}`,
		osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`,
	};
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help || !args.still) {
		printHelp();
		process.exit(args.help ? 0 : 1);
	}

	for (const tool of ['sips', 'ffmpeg', 'ffprobe', 'mdls']) {
		if (!which(tool)) die(`missing required tool: ${tool}`);
	}

	if (!existsSync(args.still)) die(`still not found: ${args.still}`);

	const videoPath = args.video || findCompanionVideo(args.still);
	if (!videoPath || !existsSync(videoPath)) {
		die(
			`video not found. Pass MOV explicitly or place ${basename(args.still, extname(args.still))}.MOV next to the still.`,
		);
	}

	const slug = resolveSlug({
		stillPath: args.still,
		videoPath,
		explicit: args.slug,
		slugFrom: args.slugFrom,
	});
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
		die(`invalid slug "${slug}" (use lowercase letters, numbers, hyphens)`);
	}

	const assetDir = join(PUBLIC_LIVE, slug);
	const photoOut = join(assetDir, 'photo.jpg');
	const videoOut = join(assetDir, 'video.mp4');
	const metaOut = join(DATA_LIVE, `${slug}.json`);
	const publicMetaOut = join(assetDir, 'meta.json');

	const photoUrl = `/images/live/${slug}/photo.jpg`;
	const videoUrl = `/images/live/${slug}/video.mp4`;

	console.log('Live Photo import');
	console.log(`  still : ${args.still}`);
	console.log(`  video : ${videoPath}`);
	console.log(`  slug  : ${slug}`);
	console.log(`  out   : ${assetDir}`);
	console.log(`  meta  : ${metaOut}`);

	if (args.dryRun) {
		console.log('dry-run: no files written');
		return;
	}

	if (existsSync(metaOut) || existsSync(assetDir)) {
		if (!args.force) {
			die(`output exists (use --force to overwrite):\n  ${assetDir}\n  ${metaOut}`);
		}
	}

	mkdirSync(assetDir, { recursive: true });
	mkdirSync(DATA_LIVE, { recursive: true });

	console.log('→ converting + compressing still…');
	const stillInfo = await convertStill(args.still, photoOut, {
		maxWidth: args.width,
		quality: args.quality,
	});
	const stillSize = { width: stillInfo.width, height: stillInfo.height };

	console.log('→ converting + compressing video (H.264 + AAC)…');
	convertVideo(videoPath, videoOut, { maxEdge: args.videoMax, crf: args.videoCrf });
	const videoInfo = probeVideo(videoOut);

	console.log('→ extracting metadata…');
	const stillMeta = extractFromStill(args.still);
	const videoMeta = extractFromVideo(videoPath);

	const latitude = stillMeta.latitude ?? videoMeta.latitude;
	const longitude = stillMeta.longitude ?? videoMeta.longitude;
	const altitude = stillMeta.altitude ?? videoMeta.altitude;

	let place = null;
	let maps = null;
	const gps =
		latitude != null && longitude != null
			? {
					latitude,
					longitude,
					altitude: altitude ?? null,
					horizontalAccuracy: videoMeta.horizontalAccuracy,
					imageDirection: stillMeta.imageDirection,
					iso6709: videoMeta.iso6709,
				}
			: null;

	if (gps && args.geocode) {
		console.log('→ reverse geocoding…');
		try {
			place = await reverseGeocode(gps.latitude, gps.longitude);
		} catch (e) {
			console.warn(`warn: reverse geocode failed: ${e?.message || e}`);
		}
		maps = mapsLinks(gps.latitude, gps.longitude, place?.label || place?.name || null);
	} else if (gps) {
		maps = mapsLinks(gps.latitude, gps.longitude, null);
	}

	const meta = {
		id: `live/${slug}`,
		slug,
		photo: photoUrl,
		video: videoUrl,
		width: stillSize.width,
		height: stillSize.height,
		duration: videoInfo.duration,
		hasAudio: videoInfo.hasAudio,
		alt: args.alt,
		caption: args.caption,
		source: {
			still: basename(args.still),
			video: basename(videoPath),
			device: videoMeta.device || stillMeta.device,
			make: stillMeta.make,
			software: videoMeta.software || stillMeta.software,
			capturedAt: videoMeta.capturedAt,
			capturedAtUtc: stillMeta.capturedAtUtc,
			contentId: videoMeta.contentId,
		},
		gps,
		place,
		maps,
		importedAt: new Date().toISOString(),
	};

	const json = `${JSON.stringify(meta, null, '\t')}\n`;
	writeFileSync(metaOut, json);
	// Sidecar next to assets (handy for CDN/debug; components should import src/data)
	writeFileSync(publicMetaOut, json);

	// Legacy flat files cleanup hint (do not auto-delete unrelated)
	console.log('');
	console.log('done.');
	console.log(`  ${photoUrl}  (${stillSize.width}×${stillSize.height})`);
	console.log(
		`  ${videoUrl}  (${videoInfo.width}×${videoInfo.height}, ${videoInfo.duration?.toFixed?.(2) ?? '?'}s, audio=${videoInfo.hasAudio})`,
	);
	if (gps) {
		console.log(`  gps     ${gps.latitude}, ${gps.longitude}`);
	}
	if (place?.label) {
		console.log(`  place   ${place.label}`);
	}
	console.log('');
	console.log('Use in Astro / MDX:');
	console.log(`  import { getLive } from '../../utils/live-photo';`);
	console.log(`  const live = getLive('${slug}');`);
	console.log(`  <LivePhoto meta={live} />`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
