/**
 * Live Photo convention helpers.
 *
 * Assets:  public/images/live/<slug>/photo.jpg + video.mp4
 * Meta:    src/data/live/<slug>.json  (written by `pnpm live:import`)
 * Slug:    default YYYY-MM-DD-HHmmss from capture time (--slug-from time)
 *
 * Load meta with `getLive(slug)` — do not static-import JSON paths that start
 * with digits (some Vite/Astro dev resolvers mishandle those module ids).
 *
 * @see scripts/import-live-photo.mjs
 * @see docs/live-photo.md
 */

export type LivePhotoGps = {
	latitude: number;
	longitude: number;
	altitude?: number | null;
	horizontalAccuracy?: number | null;
	imageDirection?: number | null;
	iso6709?: string | null;
};

export type LivePhotoPlace = {
	name?: string | null;
	region?: string | null;
	state?: string | null;
	country?: string | null;
	countryCode?: string | null;
	road?: string | null;
	/** Composed from original OSM fields — not translated */
	label?: string | null;
	displayName?: string | null;
	address?: Record<string, string>;
};

export type LivePhotoMeta = {
	id?: string;
	slug: string;
	/** Public URL, e.g. /images/live/<slug>/photo.jpg */
	photo: string;
	/** Public URL, e.g. /images/live/<slug>/video.mp4 */
	video: string;
	width?: number;
	height?: number;
	duration?: number | null;
	hasAudio?: boolean;
	alt?: string | null;
	caption?: string | null;
	source?: {
		still?: string;
		video?: string;
		device?: string | null;
		make?: string | null;
		software?: string | null;
		capturedAt?: string | null;
		capturedAtUtc?: string | null;
		contentId?: string | null;
	};
	gps?: LivePhotoGps | null;
	place?: LivePhotoPlace | null;
	maps?: {
		apple?: string;
		google?: string;
		osm?: string;
	} | null;
	importedAt?: string;
};

export type LivePhotoPropOverrides = {
	alt?: string;
	autoplayOnce?: boolean;
	sound?: boolean;
	/** Override address line (default: place.label) */
	location?: string;
	/** Override local capture time label */
	capturedAtLocal?: string;
	mapsUrl?: string;
};

/** Eager catalog of every `src/data/live/*.json` written by the import script. */
const liveCatalog = import.meta.glob<LivePhotoMeta>('../data/live/*.json', {
	eager: true,
	import: 'default',
});

function slugFromModulePath(modulePath: string): string {
	const base = modulePath.split('/').pop() ?? modulePath;
	return base.replace(/\.json$/i, '');
}

/**
 * Address line for UI: prefer `place.label` (original geocode composition).
 * Falls back to displayName, then name, then region + country if label missing.
 */
export function formatLiveLocation(place?: LivePhotoPlace | null): string | undefined {
	if (!place) return undefined;
	for (const key of ['label', 'displayName', 'name'] as const) {
		const v = place[key];
		if (typeof v === 'string' && v.trim().length > 0) return v.trim();
	}
	const parts = [place.region, place.country].filter(
		(p): p is string => typeof p === 'string' && p.trim().length > 0,
	);
	const unique: string[] = [];
	for (const p of parts) {
		if (unique[unique.length - 1] !== p) unique.push(p);
	}
	return unique.length ? unique.join(', ') : undefined;
}

/**
 * Format capture time for UI as local wall-clock (prefer QuickTime offset string).
 * Example: "2025-04-18T18:12:43+0800" → "2025-04-18 18:12 UTC+8"
 */
export function formatLiveLocalTime(
	capturedAt?: string | null,
	capturedAtUtc?: string | null,
): string | undefined {
	const raw = (capturedAt || capturedAtUtc || '').trim();
	if (!raw) return undefined;

	// 2025-04-18T18:12:43+0800 | +08:00 | Z
	const m = raw.match(
		/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?/,
	);
	if (m) {
		const [, Y, M, D, h, min, , tz] = m;
		const dateTime = `${Y}-${M}-${D} ${h}:${min}`;
		if (!tz || tz === 'Z') {
			// Absolute UTC — show as UTC (device-local unknown)
			if (tz === 'Z' || (capturedAtUtc && !capturedAt)) {
				return `${dateTime} UTC`;
			}
			return dateTime;
		}
		// Normalize +0800 / +08:00 → UTC+8
		const compact = tz.replace(':', '');
		const sign = compact[0];
		const hh = Number(compact.slice(1, 3));
		const mm = Number(compact.slice(3, 5) || '0');
		const offset =
			mm === 0 ? `UTC${sign}${hh}` : `UTC${sign}${hh}:${String(mm).padStart(2, '0')}`;
		return `${dateTime} ${offset}`;
	}

	// Fallback: parse and use local machine zone (last resort)
	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) return undefined;
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Load Live Photo meta by slug (e.g. `2025-04-18-181243`).
 */
export function getLive(slug: string): LivePhotoMeta {
	const hit = Object.entries(liveCatalog).find(
		([path]) => slugFromModulePath(path) === slug,
	);
	if (!hit) {
		const available = listLiveSlugs().join(', ') || '(none)';
		throw new Error(`Unknown live photo slug "${slug}". Available: ${available}`);
	}
	return hit[1];
}

export type ListLiveOptions = {
	/** Default `asc` (oldest first by slug / capture time). */
	order?: 'asc' | 'desc';
};

/** All imported live photo slugs (sorted by slug = capture-time name). */
export function listLiveSlugs(options: ListLiveOptions = {}): string[] {
	const slugs = Object.keys(liveCatalog).map(slugFromModulePath).sort();
	return options.order === 'desc' ? slugs.reverse() : slugs;
}

/** All live photo meta objects. */
export function listLive(options: ListLiveOptions = {}): LivePhotoMeta[] {
	return listLiveSlugs(options).map((slug) => getLive(slug));
}

/**
 * Map import meta → props for `<LivePhoto />`.
 * Caption is not used in the UI; alt is hover/title + img alt only.
 */
export function toLivePhotoProps(meta: LivePhotoMeta, overrides: LivePhotoPropOverrides = {}) {
	const latitude = meta.gps?.latitude;
	const longitude = meta.gps?.longitude;
	const hasGeo =
		typeof latitude === 'number' &&
		typeof longitude === 'number' &&
		Number.isFinite(latitude) &&
		Number.isFinite(longitude);

	return {
		photo: meta.photo,
		video: meta.video,
		width: meta.width,
		height: meta.height,
		alt: overrides.alt ?? meta.alt ?? meta.slug,
		autoplayOnce: overrides.autoplayOnce,
		sound: overrides.sound,
		location: overrides.location ?? formatLiveLocation(meta.place),
		capturedAtLocal:
			overrides.capturedAtLocal ??
			formatLiveLocalTime(meta.source?.capturedAt, meta.source?.capturedAtUtc),
		latitude: hasGeo ? latitude : undefined,
		longitude: hasGeo ? longitude : undefined,
		mapsUrl: overrides.mapsUrl ?? meta.maps?.apple ?? undefined,
	};
}
