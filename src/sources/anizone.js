import { fetchText, getTmdbInfo, USER_AGENT } from '../utils/helpers.js';

const BASE = "https://anizone.to";
const HEADERS = { "User-Agent": USER_AGENT, Referer: `${BASE}/` };

function decodeEntities(encodedString) {
    var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    var translate = { "nbsp": " ", "amp": "&", "quot": "\"", "lt": "<", "gt": ">" };
    return (encodedString || "").replace(translate_re, function (match, entity) {
        return translate[entity];
    }).replace(/&#(\d+);/g, function (match, dec) {
        return String.fromCharCode(dec);
    });
}

function processJsonArg(raw) {
    const PH = "\x01U\x01";
    let s = raw.replace(/\\\\u([0-9a-fA-F]{4})/g, `${PH}$1`);
    s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    s = s.replace(/\x01U\x01([0-9a-fA-F]{4})/g, "\\u$1");
    try { return JSON.parse(s); } catch { return {}; }
}

function pickTitle(titles) {
    return titles["1"] || titles["5"] || titles["8"] || Object.values(titles)[0] || "";
}

function extractSlug(ctx) {
    const m = ctx.match(/href="(?:https:\/\/anizone\.to)?\/anime\/([a-z0-9-]+)"/);
    return m ? m[1] : null;
}

function extractJsonArg(xdata, key) {
    const re = new RegExp(`${key}:\\s*JSON\\.parse\\('((?:[^'\\\\]|\\\\.)*)'\\)`);
    const m = xdata.match(re);
    return m ? m[1] : null;
}

async function search(query) {
    const html = await fetchText(`${BASE}/anime?search=${encodeURIComponent(query)}`, { headers: HEADERS }).catch(() => "");
    const results = [];
    const xdataRe = /x-data="(\{[^"]*anmTitles[^"]*\})"/g;
    let m;
    while ((m = xdataRe.exec(html)) !== null) {
        const ctxStart = Math.max(0, m.index - 300);
        const ctxEnd = Math.min(html.length, m.index + m[0].length + 800);
        const ctx = html.slice(ctxStart, ctxEnd);
        const slug = extractSlug(ctx);
        if (!slug) continue;
        const xdata = decodeEntities(m[1]);
        const raw = extractJsonArg(xdata, "anmTitles");
        if (!raw) continue;
        const titles = processJsonArg(raw);
        const title = pickTitle(titles);
        if (title) results.push({ slug, text: title });
    }
    return results;
}

async function scrapeWatch(slug, episodeNum) {
    const html = await fetchText(`${BASE}/anime/${slug}/${episodeNum}`, { headers: HEADERS }).catch(() => "");
    if (!html) return null;

    const hlsMatch = html.match(/<media-player[^>]+src="([^"]+\.m3u8[^"]*)"/i);
    const hls = hlsMatch ? decodeEntities(hlsMatch[1]) : null;

    return hls;
}

export async function getStream({ id, s, e, tmdbApiKey }) {
    try {
        const isTv = !!s;
        const mediaType = isTv ? 'tv' : 'movie';
        const epNum = e ? Number(e) : 1;
        const seasonNum = s ? Number(s) : 1;

        const tmdbInfo = await getTmdbInfo(tmdbApiKey, id, mediaType, seasonNum);
        const titles = tmdbInfo?.titles || [];

        let slug = null;
        for (const title of titles) {
            const results = await search(title);
            if (results.length) {
                slug = results[0].slug;
                break;
            }
        }

        if (!slug) return null;

        const hls = await scrapeWatch(slug, epNum);
        if (!hls) return null;

        return {
            allUrls: [
                {
                    url: hls,
                    server: 'AniZone',
                }
            ]
        };
    } catch (err) {
        return null;
    }
}

export async function getSources() {
    return ['AniZone'];
}