import { getDownloads, getDownloadsTv } from "./sources/trendimovies";

export async function fetchDownloads(id, s = null, e = null) {
    const res = s != null && e != null
        ? await getDownloadsTv(id, s, e)
        : await getDownloads(id);
    return res;
}