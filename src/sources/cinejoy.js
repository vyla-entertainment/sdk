import crypto from "crypto";

export const ID = "cinejoy";
export const DOMAIN = "https://cinejoy.to";
export const API_DOMAIN = "https://api.shegu.st";
export const ENC_DEC_API = "https://enc-dec.app/api";
export const RETURN_ALL_URLS = true;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

function countLeadingZeroBits(buffer) {
    let count = 0;
    for (const value of buffer) {
        if (value === 0) {
            count += 8;
            continue;
        }
        count += 8 - value.toString(2).length;
        break;
    }
    return count;
}

function solveChallenge(data) {
    const saltStr = `pow2-salt|${data.s}|${data.b}`;
    const salt = crypto.createHash("sha256").update(saltStr).digest();
    const n = data.n;
    const r = data.r;
    const p = data.p;
    const d = data.d;
    const b = data.b;
    const s = data.s;

    for (let counter = 0; counter < 1000000; counter++) {
        const payload = `pow2|${b}|${s}|${counter}`;
        const result = crypto.scryptSync(payload, salt, 32, {
            N: n,
            r: r,
            p: p,
            maxmem: 128 * n * r * 2
        });

        if (countLeadingZeroBits(result) >= d) {
            const solved = { ...data, c: counter };
            return Buffer.from(JSON.stringify(solved)).toString("base64");
        }
    }
    throw new Error("Challenge solve failed");
}

async function getTmdbMetadata(tmdbId, isTv) {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return null;
    const type = isTv ? "tv" : "movie";
    try {
        const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}&append_to_response=external_ids`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return null;
        const data = await res.json();
        const title = isTv ? data.name : data.title;
        const year = isTv ? (data.first_air_date ? data.first_air_date.split("-")[0] : "") : (data.release_date ? data.release_date.split("-")[0] : "");
        const imdbId = data.external_ids?.imdb_id || "";
        return { title, year, imdbId };
    } catch (err) {
        return null;
    }
}

export async function getStream({ id, s, e, clientIP }) {
    try {
        const isTv = s && e && s !== "null" && e !== "null";
        const meta = await getTmdbMetadata(id, isTv);
        if (!meta) return null;

        let servers = [];
        try {
            const serverRes = await fetch(`${API_DOMAIN}/servers`, {
                headers: {
                    "Origin": DOMAIN,
                    "Referer": DOMAIN + "/",
                    "User-Agent": UA
                },
                signal: AbortSignal.timeout(15000)
            });
            if (serverRes.ok) {
                const data = await serverRes.json();
                servers = data.servers || [];
            }
        } catch (err) { }

        const activeServers = servers
            .filter(srv => srv.status === "ok" && srv.name)
            .map(srv => srv.name);

        if (activeServers.length === 0) return null;

        const allUrls = [];

        for (const serverName of activeServers) {
            try {
                const queryParts = [
                    `title=${encodeURIComponent(meta.title)}`,
                    `type=${isTv ? "series" : "movie"}`,
                    `year=${meta.year}`,
                    `imdb=${meta.imdbId}`,
                    `tmdb=${id}`,
                    `server=${serverName}`
                ];
                if (isTv) {
                    queryParts.push(`season=${s}`, `episode=${e}`);
                }

                const plainUrl = `${API_DOMAIN}/?${queryParts.join("&")}`;

                const encRes = await fetch(`${ENC_DEC_API}/enc-cinejoy?url=${encodeURIComponent(plainUrl)}`, {
                    headers: { "User-Agent": UA },
                    signal: AbortSignal.timeout(15000)
                });
                if (!encRes.ok) continue;
                const encData = await encRes.json();
                if (encData.status !== 200) continue;

                const rid = encData.result;

                const challengeRes = await fetch(`${API_DOMAIN}/challenge?rid=${rid}`, {
                    headers: {
                        "Origin": DOMAIN,
                        "Referer": DOMAIN + "/",
                        "User-Agent": UA
                    },
                    signal: AbortSignal.timeout(30000)
                });
                if (!challengeRes.ok) continue;

                const challengeData = await challengeRes.json();

                const solved = solveChallenge(challengeData);

                const streamRes = await fetch(`${API_DOMAIN}/${rid}`, {
                    headers: {
                        "Origin": DOMAIN,
                        "Referer": DOMAIN + "/",
                        "User-Agent": UA,
                        "X-At": solved
                    },
                    signal: AbortSignal.timeout(30000)
                });

                if (!streamRes.ok) continue;

                const encryptedText = await streamRes.text();

                const decRes = await fetch(`${ENC_DEC_API}/dec-cinejoy`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": UA
                    },
                    body: JSON.stringify({ text: encryptedText }),
                    signal: AbortSignal.timeout(15000)
                });
                if (!decRes.ok) continue;
                const decData = await decRes.json();
                if (decData.status !== 200) continue;

                let decryptedText = decData.result;

                if (!decryptedText) continue;

                if (typeof decryptedText === "string") {
                    try {
                        decryptedText = JSON.parse(decryptedText);
                    } catch (e) { }
                }

                let streamUrl = "";
                if (decryptedText && typeof decryptedText === "object") {
                    if (decryptedText.stream && decryptedText.stream[0]) {
                        streamUrl = decryptedText.stream[0].playlist || decryptedText.stream[0].url || "";
                    } else {
                        streamUrl = decryptedText.url || decryptedText.playlist || decryptedText.file || "";
                    }
                } else if (typeof decryptedText === "string") {
                    streamUrl = decryptedText.trim();
                }

                if (streamUrl.startsWith("http")) {
                    allUrls.push({
                        url: streamUrl,
                        headers: {
                            "User-Agent": UA,
                            "Referer": DOMAIN + "/",
                            "Origin": DOMAIN
                        },
                        server: serverName,
                        quality: "Auto",
                        type: "hls",
                        skipVerify: true,
                        skipProxy: true
                    });
                }
            } catch (err) { }
        }

        if (allUrls.length > 0) {
            return { ...allUrls[0], allUrls };
        }
    } catch (err) { }
    return null;
}