import crypto from 'node:crypto';
import { fetchJson, getTmdbInfo, tmdbToAnilist, USER_AGENT } from '../utils/helpers.js';

const BASE = "https://reanime.to";
const FLIX = "https://flixcloud.cc";
const HEADERS = { "User-Agent": USER_AGENT, Accept: "application/json, */*" };

async function sha256hex(s) {
    const buf = await crypto.subtle.digest("SHA-256", typeof s === "string" ? new TextEncoder().encode(s) : s);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64toU8(b64) {
    const bin = Buffer.from(b64, 'base64');
    return new Uint8Array(bin);
}

async function deriveFields(seed) {
    let e = seed;
    for (let i = 0; i < 3; i++) e = await sha256hex(e + i);
    let l = e;
    for (let i = 0; i < 3; i++) l = await sha256hex(l + i);
    return {
        keyField: "kf_" + e.substring(8, 16),
        ivField: "ivf_" + e.substring(16, 24),
        containerName: "cd_" + e.substring(24, 32),
        arrayName: "ad_" + e.substring(32, 40),
        objectName: "od_" + e.substring(40, 48),
        tokenField: e.substring(48, 64) + "_" + e.substring(56, 64),
        keyFrag2Field: l.substring(0, 16) + "_" + l.substring(16, 24)
    };
}

function extractSsrObj(html) {
    const m = html.match(/\{type:"data",data:(\{)/);
    if (!m) return null;
    let depth = 0;
    const start = html.indexOf("{", m.index + m[0].length - 1);
    for (let i = start; i < html.length; i++) {
        if (html[i] === "{") depth++;
        else if (html[i] === "}") {
            if (--depth === 0) return html.slice(start, i + 1);
        }
    }
    return null;
}

function parseJsLiteral(src) {
    let i = 0;
    function ws() { while (i < src.length && /\s/.test(src[i])) i++; }
    function parseValue() {
        ws();
        if (src[i] === "{") return parseObject();
        if (src[i] === "[") return parseArray();
        if (src[i] === '"') return parseDStr();
        if (src[i] === "'") return parseSStr();
        if (src.startsWith("true", i)) { i += 4; return true; }
        if (src.startsWith("false", i)) { i += 5; return false; }
        if (src.startsWith("null", i)) { i += 4; return null; }
        if (src.startsWith("undefined", i)) { i += 9; return null; }
        if (src.startsWith("!0", i)) { i += 2; return true; }
        if (src.startsWith("!1", i)) { i += 2; return false; }
        const m = src.slice(i).match(/^-?[\d.]+([eE][+-]?\d+)?/);
        if (m) { i += m[0].length; return parseFloat(m[0]); }
        throw new Error(`Parse error`);
    }
    function parseDStr() {
        let r = ""; i++;
        while (i < src.length && src[i] !== '"') {
            if (src[i] === "\\") { i++; r += src[i++]; }
            else r += src[i++];
        }
        i++; return r;
    }
    function parseSStr() {
        let r = ""; i++;
        while (i < src.length && src[i] !== "'") {
            if (src[i] === "\\") { i++; r += src[i++]; }
            else r += src[i++];
        }
        i++; return r;
    }
    function parseKey() {
        ws();
        if (src[i] === '"') return parseDStr();
        if (src[i] === "'") return parseSStr();
        const m = src.slice(i).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
        if (m) { i += m[0].length; return m[0]; }
        throw new Error(`Bad key`);
    }
    function parseObject() {
        const obj = {}; i++; ws();
        while (i < src.length && src[i] !== "}") {
            if (src[i] === ",") { i++; ws(); continue; }
            const k = parseKey(); ws(); i++;
            obj[k] = parseValue(); ws();
        }
        i++; return obj;
    }
    function parseArray() {
        const arr = []; i++; ws();
        while (i < src.length && src[i] !== "]") {
            if (src[i] === ",") { i++; ws(); continue; }
            arr.push(parseValue()); ws();
        }
        i++; return arr;
    }
    return parseValue();
}

function parseWasmDecrypt(wasmBytes) {
    const b = wasmBytes;
    let pos = 8;
    while (pos < b.length) {
        const secId = b[pos++];
        let sz = 0, sh = 0, by;
        do { by = b[pos++]; sz |= (by & 127) << sh; sh += 7; } while (by & 128);
        if (secId === 10) {
            pos++;
            let sbs = 0, sh2 = 0, by2;
            do { by2 = b[pos++]; sbs |= (by2 & 127) << sh2; sh2 += 7; } while (by2 & 128);
            pos += sbs; break;
        }
        pos += sz;
    }
    let rbs = 0, sh3 = 0, by3;
    do { by3 = b[pos++]; rbs |= (by3 & 127) << sh3; sh3 += 7; } while (by3 & 128);
    const r = b.slice(pos, pos + rbs);
    function leb(arr, i) {
        let v = 0, s = 0, b2;
        do { b2 = arr[i++]; v |= (b2 & 127) << s; s += 7; } while (b2 & 128);
        return [v, i];
    }
    const XOR_END = [32, 2, 32, 5, 106, 45, 0, 0, 115, 33, 6];
    let txStart = -1;
    outer: for (let i = 0; i < r.length - XOR_END.length; i++) {
        for (let j = 0; j < XOR_END.length; j++) if (r[i + j] !== XOR_END[j]) continue outer;
        txStart = i + XOR_END.length; break;
    }
    if (txStart < 0) return null;
    let txEnd = -1, step = 36;
    for (let i = txStart; i < r.length - 4; i++) {
        if (r[i] === 32 && r[i + 1] === 5 && r[i + 2] === 65) {
            const [val, ni] = leb(r, i + 3);
            if (r[ni] === 108) { txEnd = i; step = val; break; }
        }
    }
    if (txEnd < 0) return null;
    const code = r.slice(txStart, txEnd);
    function transform(inputByte) {
        let local6 = inputByte & 255;
        const stk = []; let i = 0;
        while (i < code.length) {
            const op = code[i++];
            if (op === 32) { const [idx, ni] = leb(code, i); i = ni; stk.push(idx === 6 ? local6 : 0); }
            else if (op === 33) { const [idx, ni] = leb(code, i); i = ni; const v = stk.pop(); if (idx === 6) local6 = v & 255; }
            else if (op === 65) { const [v, ni] = leb(code, i); i = ni; stk.push(v); }
            else if (op === 106) { const b2 = stk.pop(), a = stk.pop(); stk.push(a + b2 & 255); }
            else if (op === 107) { const b2 = stk.pop(), a = stk.pop(); stk.push(a - b2 + 256 & 255); }
            else if (op === 113) { const b2 = stk.pop(), a = stk.pop(); stk.push(a & b2 & 255); }
            else if (op === 114) { const b2 = stk.pop(), a = stk.pop(); stk.push((a | b2) & 255); }
            else if (op === 115) { const b2 = stk.pop(), a = stk.pop(); stk.push((a ^ b2) & 255); }
            else if (op === 116) { const b2 = stk.pop(), a = stk.pop(); stk.push(a << (b2 & 7) & 255); }
            else if (op === 118) { const b2 = stk.pop(), a = stk.pop(); stk.push(a >>> (b2 & 7) & 255); }
        }
        return local6;
    }
    return { step, transform };
}

function runDecrypt(wasmBytes, frag1, kf2, T, seedInt) {
    const parsed = parseWasmDecrypt(wasmBytes);
    if (!parsed) return null;
    const { step, transform } = parsed;
    const out = new Uint8Array(frag1.length);
    for (let i = 0; i < frag1.length; i++) {
        const c = (frag1[i] ^ kf2[i] ^ T[i]) & 255;
        out[i] = transform(c) ^ i * step + seedInt & 255;
    }
    return out;
}

async function decryptEmbed(html) {
    const raw = extractSsrObj(html);
    if (!raw) return null;
    const data = parseJsLiteral(raw);
    const seed = data.obfuscation_seed;
    if (!seed) return null;

    const fields = await deriveFields(seed);
    const ocd = data.obfuscated_crypto_data;
    if (!ocd) return null;

    const container = ocd[fields.containerName];
    if (!container) return null;

    const arr = container[fields.arrayName];
    if (!arr || !arr[0]) return null;

    const obj = arr[0][fields.objectName];
    if (!obj) return null;

    const frag1 = b64toU8(obj[fields.keyField]);
    const iv = b64toU8(obj[fields.ivField]);
    const kf2raw = data[fields.keyFrag2Field];
    if (!kf2raw) return null;

    const kf2 = b64toU8(kf2raw);
    const token = data[fields.tokenField];
    if (!token) return null;

    const tokData = await fetchJson(`${FLIX}/api/m3u8/${token}`, { headers: { ...HEADERS, Referer: `${BASE}/` } }).catch(() => null);
    if (!tokData) return null;

    const vidKey = (await sha256hex(token + "vid")).substring(0, 10);
    const keyKey = (await sha256hex(token + "key")).substring(0, 10);
    const v_bytes = b64toU8(tokData[vidKey] || "");
    const T_bytes = b64toU8(tokData[keyKey] || "");

    if (!v_bytes.length || !T_bytes.length) return null;

    const seedInt = parseInt(seed.substring(0, 8), 16);
    const wPayload = b64toU8(data.w_payload ?? "");
    if (!wPayload.length) return null;

    const wasmOut = runDecrypt(wPayload, frag1, kf2, T_bytes, seedInt);
    if (!wasmOut) return null;

    const keyMat = await crypto.subtle.importKey("raw", wasmOut, { name: "PBKDF2" }, false, ["deriveBits"]);
    const derived = new Uint8Array(await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: new TextEncoder().encode(seed), iterations: 1000, hash: "SHA-256" },
        keyMat,
        256
    ));

    for (let i = 0; i < 32; i++) derived[i] ^= seed.charCodeAt(i % seed.length);

    const aesKeyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", derived));
    const aesKey = await crypto.subtle.importKey("raw", aesKeyBytes, { name: "AES-CBC" }, false, ["decrypt"]);

    const plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, aesKey, v_bytes).catch(() => null);
    if (!plain) return null;

    const url = new TextDecoder().decode(plain).trim().replace(/\0+$/, "");
    if (!url.startsWith("http")) return null;

    return { url };
}

async function searchReanime(query) {
    const data = await fetchJson(`${BASE}/api/v1/search?${new URLSearchParams({ q: query, limit: 10 })}`, { headers: HEADERS }).catch(() => null);
    return Array.isArray(data?.results) ? data.results : [];
}

export async function getStream({ id, s, e, audio, tmdbApiKey }) {
    try {
        const isTv = !!s;
        const mediaType = isTv ? 'tv' : 'movie';
        const epNum = e ? Number(e) : 1;
        const seasonNum = s ? Number(s) : 1;

        let anilistId = null;
        let titles = [];
        const tmdbInfo = await getTmdbInfo(tmdbApiKey, id, mediaType, seasonNum);

        if (tmdbInfo) {
            titles = tmdbInfo.titles || [];
            anilistId = await tmdbToAnilist(id, mediaType, seasonNum, titles, tmdbInfo.year);
        }
        if (!anilistId) {
            anilistId = Number(id);
        }

        let animeSlug = null;
        for (const title of titles) {
            const results = await searchReanime(title);
            if (results.length) {
                animeSlug = results[0].anime_id;
                break;
            }
        }

        if (!animeSlug) return null;

        const audioPref = audio === 'dub' ? 'dub' : 'sub';
        const watchRes = await fetchJson(`${BASE}/api/watch/${animeSlug}/${epNum}`, { headers: HEADERS }).catch(() => null);
        const links = [...(watchRes?.episode_links || [])];

        const flixRes = await fetchJson(`${BASE}/api/flix/${anilistId}/${epNum}`, { headers: HEADERS }).catch(() => null);
        if (flixRes?.success && Array.isArray(flixRes.servers)) {
            const seen = new Set(links.map((s) => s["$id"]));
            for (const srv of flixRes.servers) {
                if (!seen.has(srv["$id"])) links.push(srv);
            }
        }

        const audioTypes = audioPref === "sub" ? ["sub", "s-sub"] : ["dub", "s-dub"];
        const servers = links.filter((srv) => audioTypes.includes(srv.dataType));
        if (!servers.length) return null;

        const urls = [];
        for (const srv of servers.slice(0, 3)) {
            if (!srv.dataLink) continue;
            const res = await fetch(srv.dataLink, { headers: { ...HEADERS, Referer: `${BASE}/` } }).catch(() => null);
            if (!res || !res.ok) continue;
            const html = await res.text();
            const stream = await decryptEmbed(html);
            if (stream?.url) {
                urls.push({
                    url: stream.url,
                    server: `Reanime - ${srv.serverName || 'Server'}`,
                });
            }
        }

        return urls.length ? { allUrls: urls } : null;
    } catch (err) {
        return null;
    }
}

export async function getSources() {
    return ['Reanime'];
}