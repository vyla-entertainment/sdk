import { fetchJson, fetchText, getTmdbInfo, tmdbToAnilist, USER_AGENT } from '../utils/helpers.js';

const ANIKOTO = "https://anikototv.to";
const MEGAPLAY = "https://megaplay.buzz";
const VIDWISH = "https://vidwish.live";
const SPOOF_REF = "https://hianimes.re/";
const HEADERS = { "User-Agent": USER_AGENT, Accept: "text/html,*/*" };

function extractEpisodes(html) {
    const episodes = [];
    const re = /<a\s[^>]*data-id="[^"]*"[^>]*>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const tag = m[0];
        const getAttr = (a) => {
            const x = tag.match(new RegExp(`data-${a}="([^"]*)"`));
            return x ? x[1] : "";
        };
        const id = getAttr("id"), num = getAttr("num");
        if (!id || !num) continue;
        episodes.push({ id, num: parseInt(num), slug: getAttr("slug"), hasSub: getAttr("sub") === "1", hasDub: getAttr("dub") === "1", ids: getAttr("ids") });
    }
    return episodes;
}

function extractSearchCandidates(html) {
    const results = [];
    const re = /<a class="item" href="https:\/\/anikototv\.to\/watch\/([^"]+)"([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const block = m[2];
        const enM = block.match(/class="name d-title"[^>]*>([^<]*)</);
        const jpM = block.match(/data-jp="([^"]*)"/);
        results.push({ slug: m[1], titleEn: enM ? enM[1].trim() : "", titleJp: jpM ? jpM[1].trim() : "" });
    }
    return results;
}

async function searchAnikoto(keyword) {
    const data = await fetchJson(`${ANIKOTO}/ajax/anime/search?keyword=${encodeURIComponent(keyword)}`, {
        headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest", Referer: `${ANIKOTO}/` }
    }).catch(() => null);

    const results = extractSearchCandidates(data?.result?.html ?? "");
    const html = await fetchText(`${ANIKOTO}/filter?keyword=${encodeURIComponent(keyword)}`, { headers: { ...HEADERS, Referer: `${ANIKOTO}/` } }).catch(() => "");

    for (const m of html.matchAll(/<a class="name d-title" href="https:\/\/anikototv\.to\/watch\/([^"/]+)(?:\/ep-\d+)?" data-jp="([^"]*)">([\s\S]*?)<\/a>/g)) {
        results.push({
            slug: m[1],
            titleEn: m[3].replace(/<[^>]*>/g, "").trim(),
            titleJp: m[2].trim()
        });
    }

    const seen = new Set();
    return results.filter((r) => {
        if (seen.has(r.slug)) return false;
        seen.add(r.slug);
        return true;
    });
}

async function findAnikotoShow(title) {
    const candidates = await searchAnikoto(title);
    if (!candidates.length) return null;
    const chosenSlug = candidates[0].slug;

    const pageHtml = await fetchText(`${ANIKOTO}/watch/${chosenSlug}`, { headers: { ...HEADERS, Referer: `${ANIKOTO}/` } });
    const idM = pageHtml.match(/data-id="(\d+)"/);
    if (!idM) return null;
    return { slug: chosenSlug, showId: idM[1] };
}

async function extractVidWish(realId, audio) {
    try {
        const page = await fetchText(`${VIDWISH}/stream/s-2/${realId}/${audio}`, { headers: { ...HEADERS, Referer: SPOOF_REF } });
        const m = page.match(/data-id="([^"]*)"/);
        if (!m?.[1]) return null;
        const fileId = m[1];
        const data = await fetchJson(`${VIDWISH}/stream/getSources?id=${fileId}&id=${fileId}`, { headers: { ...HEADERS, Referer: `${VIDWISH}/`, "X-Requested-With": "XMLHttpRequest" } });
        return { fileId, data };
    } catch {
        return null;
    }
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

        const audioPref = audio === 'dub' ? 'dub' : 'sub';
        let embedUrl = `${MEGAPLAY}/stream/ani/${anilistId}/${epNum}/${audioPref}`;
        let megaHtml = await fetchText(embedUrl, { headers: { ...HEADERS, Referer: SPOOF_REF } }).catch(() => '');

        const frameSrc = megaHtml.match(/<iframe\b[^>]*src="([^"]+)"/i)?.[1];
        if (!megaHtml.match(/data-id="([^"]*)"/) && frameSrc) {
            embedUrl = frameSrc.startsWith("http") ? frameSrc : `${MEGAPLAY}${frameSrc}`;
            megaHtml = await fetchText(embedUrl, { headers: { ...HEADERS, Referer: SPOOF_REF } }).catch(() => '');
        }

        const attrMatch = (name) => {
            const m = megaHtml.match(new RegExp(`data-${name}="([^"]*)"`));
            return m ? m[1] : null;
        };

        const fileId = attrMatch("id");
        const realId = attrMatch("realid");

        const urls = [];

        if (fileId) {
            const megaSources = await fetchJson(`${MEGAPLAY}/stream/getSources?id=${fileId}&id=${fileId}`, {
                headers: { ...HEADERS, Referer: `${MEGAPLAY}/`, "X-Requested-With": "XMLHttpRequest" }
            }).catch(() => null);

            if (megaSources?.sources?.file) {
                urls.push({
                    url: megaSources.sources.file,
                    server: 'AniKoto (Megaplay)',
                });
            }
        }

        if (realId) {
            const vidwish = await extractVidWish(realId, audioPref);
            if (vidwish?.data?.sources?.file) {
                urls.push({
                    url: vidwish.data.sources.file,
                    server: 'AniKoto (VidWish)',
                });
            }
        }

        if (!urls.length && titles.length) {
            const show = await findAnikotoShow(titles[0]);
            if (show) {
                const listData = await fetchJson(`${ANIKOTO}/ajax/episode/list/${show.showId}`, {
                    headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest", Referer: `${ANIKOTO}/watch/${show.slug}` }
                }).catch(() => null);

                const episodes = extractEpisodes(listData?.result ?? "");
                const ep = episodes.find((item) => item.num === epNum);
                if (ep && ep.ids) {
                    const serverData = await fetchJson(`${ANIKOTO}/ajax/server/list?servers=${encodeURIComponent(ep.ids)}`, {
                        headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest", Referer: `${ANIKOTO}/` }
                    }).catch(() => null);

                    const items = [];
                    const typeRe = /<div class="type" data-type="(sub|dub)">([\s\S]*?)<\/ul>\s*<\/div>/g;
                    let typeM;
                    while ((typeM = typeRe.exec(serverData?.result ?? "")) !== null) {
                        if (typeM[1] !== audioPref) continue;
                        for (const li of typeM[2].matchAll(/<li\s+([^>]*data-link-id[^>]*)>([\s\S]*?)<\/li>/g)) {
                            const linkId = li[1].match(/data-link-id="([^"]+)"/)?.[1];
                            const name = li[2].replace(/<[^>]+>/g, "").trim();
                            if (linkId) items.push({ linkId, name });
                        }
                    }

                    for (const item of items) {
                        const resolved = await fetchJson(`${ANIKOTO}/ajax/server?get=${encodeURIComponent(item.linkId)}`, {
                            headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest", Referer: `${ANIKOTO}/` }
                        }).catch(() => null);
                        if (resolved?.result?.url) {
                            urls.push({
                                url: resolved.result.url,
                                server: `AniKoto (${item.name})`,
                            });
                        }
                    }
                }
            }
        }

        return urls.length ? { allUrls: urls } : null;
    } catch (err) {
        return null;
    }
}

export async function getSources() {
    return ['AniKoto'];
}