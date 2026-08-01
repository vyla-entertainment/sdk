import { USER_AGENT } from '../utils/helpers.js';

const lS = [17, 91, 203, 44, 8, 177, 62, 239, 119, 3, 154, 81, 28, 210, 101, 7];

function lA(e) {
    let t = e >>> 0;
    t ^= t >>> 16;
    t = Math.imul(t, 0x7feb352d) >>> 0;
    t ^= t >>> 15;
    t = Math.imul(t, 0x846ca68b) >>> 0;
    return (t ^ (t >>> 16)) >>> 0;
}

function lL(keyStr, targetLen) {
    const encoder = new TextEncoder();
    const i = encoder.encode(keyStr || "dev");
    const rLen = Math.max(32, Math.min(128, targetLen + 17));
    const r = new Uint8Array(rLen);
    let s = 0x811c9dc5;
    for (let e = 0; e < rLen; e += 1) {
        const a = i[e % i.length] ?? e;
        s ^= a;
        s = lA((s + lS[e % lS.length] + ((0x9e3779b1 * e) >>> 0)) >>> 0);
        r[e] = s & 255;
    }
    return r;
}

function base64UrlEncode(bytes) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let i = "";
    for (let r = 0; r < bytes.length; r += 3) {
        const s = bytes[r];
        const a = bytes[r + 1];
        const n = bytes[r + 2];
        i += chars[s >>> 2];
        i += chars[((3 & s) << 4) | ((a ?? 0) >>> 4)];
        if (a === undefined) break;
        i += chars[((15 & a) << 2) | ((n ?? 0) >>> 6)];
        if (n === undefined) break;
        i += chars[63 & n];
    }
    return i;
}

export function generateCineSuUrl(type, tmdbId, season = 1, episode = 1) {
    const kind = type === "show" || type === "tv" ? "show" : "movie";
    const s = kind === "show" ? Math.max(1, Math.floor(season)) : 0;
    const ep = kind === "show" ? Math.max(1, Math.floor(episode)) : 0;
    const char = kind[0];

    const payloadStr = `4860ac8bfddb:${char}:${Math.floor(Number(tmdbId))}:${s}:${ep}`;
    const encoder = new TextEncoder();
    const d = encoder.encode(payloadStr);

    const key = "224eff10e662e9635c9f671cf46351dcd69af42b1edd56f5e5fa21751f44b9c8";
    const u = lL(key, d.length);

    const h = new Uint8Array(d.length + 2);
    h[0] = 255 & d.length;
    h[1] = (d.length >>> 8) & 255;

    let c = (0x9e3779b9 ^ d.length) >>> 0;
    for (let e = 0; e < d.length; e += 1) {
        c = lA((c + u[e % u.length] + lS[e % lS.length] + e) >>> 0);
        h[e + 2] = d[e] ^ (255 & c) ^ u[(7 * e + 3) % u.length];
    }

    const token = base64UrlEncode(h);
    return `https://glendale-plumbing.com/c/v1/${token}/master.m3u8`;
}

export async function getStream({ id, s, e }) {
    try {
        const isTv = !!s;
        const mediaType = isTv ? 'tv' : 'movie';
        const m3u8Url = generateCineSuUrl(mediaType, id, s || 1, e || 1);

        return {
            allUrls: [
                {
                    url: m3u8Url,
                    server: 'CineSu',
                }
            ]
        };
    } catch (err) {
        return null;
    }
}

export async function getSources() {
    return ['CineSu'];
}