/**
 * Shared media compression helpers for Live Photo assets.
 *
 * - Stills  → web JPEG via sharp (mozjpeg, progressive, metadata stripped)
 * - Videos  → H.264 + AAC via ffmpeg (faststart, long edge capped)
 *
 * Used by both `scripts/import-live-photo.mjs` (new imports) and
 * `scripts/compress-live.mjs` (re-compress assets already in the repo), so the
 * two paths stay in sync.
 */

import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';

export const DEFAULT_JPEG_QUALITY = 80;
export const DEFAULT_VIDEO_CRF = 26;
export const DEFAULT_VIDEO_MAX_EDGE = 1280;
export const DEFAULT_VIDEO_FPS = 30;

export function fileSize(path) {
	try {
		return statSync(path).size;
	} catch {
		return 0;
	}
}

export function formatBytes(n) {
	if (!n) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
	return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

let sharpModule;

/** Lazily load sharp so tooling that never touches images still runs. */
async function loadSharp() {
	if (sharpModule === undefined) {
		try {
			sharpModule = (await import('sharp')).default;
		} catch {
			sharpModule = null;
		}
	}
	return sharpModule;
}

/**
 * Compress (and optionally downscale) a still into a web JPEG.
 * Input and output must be different paths. Returns final {width,height,size}.
 */
export async function compressJpeg(input, output, opts = {}) {
	const sharp = await loadSharp();
	if (!sharp) {
		throw new Error('sharp is required for image compression (run `pnpm install`)');
	}
	const quality = opts.quality ?? DEFAULT_JPEG_QUALITY;
	const maxWidth = opts.maxWidth ?? null;

	// rotate() bakes EXIF orientation in; sharp then drops metadata by default.
	let pipeline = sharp(input, { failOn: 'none' }).rotate();
	if (maxWidth) {
		pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
	}
	const info = await pipeline
		.jpeg({ quality, mozjpeg: true, progressive: true })
		.toFile(output);
	return { width: info.width, height: info.height, size: info.size };
}

/**
 * Encode a video to web H.264 + AAC, long edge capped at maxEdge.
 * Works for both MOV→MP4 (import) and MP4→MP4 (re-compress).
 */
export function encodeVideo(input, output, opts = {}) {
	const crf = opts.crf ?? DEFAULT_VIDEO_CRF;
	const maxEdge = opts.maxEdge ?? DEFAULT_VIDEO_MAX_EDGE;
	const fps = opts.fps ?? DEFAULT_VIDEO_FPS;

	// scale so the long edge ≤ maxEdge; keep aspect ratio; keep audio as AAC
	const vf = `scale='min(${maxEdge},iw)':'min(${maxEdge},ih)':force_original_aspect_ratio=decrease`;
	const args = [
		'-y',
		'-hide_banner',
		'-loglevel',
		'error',
		'-i',
		input,
		'-r',
		String(fps),
		'-c:v',
		'libx264',
		'-preset',
		'slow',
		'-crf',
		String(crf),
		'-pix_fmt',
		'yuv420p',
		'-vf',
		vf,
		'-c:a',
		'aac',
		'-b:a',
		'128k',
		'-ac',
		'2',
		'-movflags',
		'+faststart',
		output,
	];
	const r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
	if (r.status !== 0) {
		throw new Error(`ffmpeg failed: ${(r.stderr || r.stdout || '').trim()}`);
	}
}
