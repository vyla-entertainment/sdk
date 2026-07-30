// i can't fix this, i'll wait for someone else to fix this lol

import crypto from 'node:crypto';
import { fetchJson, USER_AGENT } from '../utils/helpers.js';

const CORE_URL = 'https://core.vidzee.wtf';
const PLAYER_URL = 'https://player.vidzee.wtf';
const KEY = 'c4a8f1d7e2b9a6c3d0f5e8a1b7c4d9e2';

function decryptAes(encryptedBase64) {
    const keyBuf = Buffer.from(KEY, 'utf8');
    const ciphertext = Buffer.from(encryptedBase64, 'base64');

    try {
        const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
        decipher.setAutoPadding(true);
        let dec = decipher.update(ciphertext);
        dec = Buffer.concat([dec, decipher.final()]);
        const text = dec.toString('utf8');
        if (text.startsWith('http') || text.includes('{')) return text;
    } catch { }

    try {
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
        decipher.setAutoPadding(true);
        let dec = decipher.update(ciphertext);
        dec = Buffer.concat([dec, decipher.final()]);
        const text = dec.toString('utf8');
        if (text.startsWith('http') || text.includes('{')) return text;
    } catch { }

    try {
        const iv = ciphertext.subarray(0, 16);
        const data = ciphertext.subarray(16);
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
        decipher.setAutoPadding(true);
        let dec = decipher.update(data);
        dec = Buffer.concat([dec, decipher.final()]);
        const text = dec.toString('utf8');
        if (text.startsWith('http') || text.includes('{')) return text;
    } catch { }

    return null;
}

export async function getStream({ id, s, e, clientIP }) {
    const headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': PLAYER_URL,
        'Origin': PLAYER_URL,
        ...(clientIP && { 'X-Forwarded-For': clientIP })
    };

    try {
        const isTv = s != null && e != null;
        const servers = ['tik', 'ipcloud', 'v6:Hindi'];
        const results = [];

        for (const sr of servers) {
            try {
                const url = isTv
                    ? `${CORE_URL}/streams/tv/${id}/${s}/${e}?s=${encodeURIComponent(sr)}&e=${e}`
                    : `${CORE_URL}/streams/movie/${id}?s=${encodeURIComponent(sr)}&e=1`;

                const data = await fetchJson(url, { headers, signal: AbortSignal.timeout(6000) });

                if (data && data.c) {
                    const decryptedText = decryptAes(data.c);
                    if (decryptedText) {
                        let streamUrl = decryptedText;
                        let extraHeaders = {};

                        if (decryptedText.startsWith('{')) {
                            try {
                                const parsed = JSON.parse(decryptedText);
                                streamUrl = parsed.url || parsed.link || parsed.file;
                                if (parsed.headers) extraHeaders = parsed.headers;
                            } catch { }
                        }

                        if (streamUrl && streamUrl.startsWith('http')) {
                            results.push({
                                url: streamUrl,
                                server: `VidZee - ${sr}`,
                                skipHlsCheck: true,
                                headers: {
                                    'User-Agent': USER_AGENT,
                                    'Referer': PLAYER_URL,
                                    'Origin': PLAYER_URL,
                                    ...extraHeaders
                                }
                            });
                        }
                    }
                }
            } catch (err) {
            }
        }

        return results.length ? { allUrls: results } : null;
    } catch {
        return null;
    }
}