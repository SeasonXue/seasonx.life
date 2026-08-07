/**
 * 估算阅读时间（支持中英混合）
 * - 中文/日文/韩文：约 300 字/分钟
 * - 英文及其他：约 200 词/分钟
 */
export function getReadingTime(text: string): number {
	const clean = text
		.replace(/```[\s\S]*?```/g, '')
		.replace(/`[^`]+`/g, '')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/[#>*_\-|]/g, ' ')
		.trim();

	const cjk = clean.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g);
	const cjkCount = cjk?.length ?? 0;

	const withoutCjk = clean.replace(
		/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g,
		' ',
	);
	const words = withoutCjk.split(/\s+/).filter(Boolean).length;

	const minutes = cjkCount / 300 + words / 200;
	return Math.max(1, Math.ceil(minutes));
}

export function formatReadingTime(minutes: number): string {
	return `约 ${minutes} 分钟阅读`;
}
