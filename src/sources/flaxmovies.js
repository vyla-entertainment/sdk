import { fetchJson } from '../utils/helpers.js';

export async function getStream({ id, s, e }) {
    try {
        const url = s && e
            ? `https://sparkling-mode-a1ed.fillatame.workers.dev/?tmdb_id=${id}&season=${s}&episode=${e}`
            : `https://sparkling-mode-a1ed.fillatame.workers.dev/?tmdb_id=${id}`;
        const data = await fetchJson(url, { signal: AbortSignal.timeout(15000) });
        if (!data || !Array.isArray(data.streams)) return null;
        const allUrls = [];
        for (const stream of data.streams) {
            const streamUrl = stream.url || stream.link;
            if (!streamUrl) continue;
            const isHls = stream.format === 'HLS' || stream.isM3U8 === true || streamUrl.includes('m3u8');
            allUrls.push({
                url: streamUrl,
                server: stream.provider || 'FlaxMovies',
                quality: stream.resolution || 'Auto',
                type: isHls ? 'hls' : 'mp4'
            });
        }
        return allUrls.length ? { allUrls } : null;
    } catch {
        return null;
    }
}