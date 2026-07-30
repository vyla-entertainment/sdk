// usage: npm test
// comment out the tests you don't want to run

import VylaSDK from "../src/sdk.js";
// import dotenv from "dotenv";
// dotenv.config();

const sdk = new VylaSDK({
    tmdbApiKey: process.env.TMDB_API_KEY
});

try {
    const movieSubs = await sdk.getSubtitles("155");
    console.log("Movie Subtitles Count:", movieSubs.length);
    console.log("First Subtitle Sample:", movieSubs[0] || "None");
} catch (err) {
    console.error("Movie Subtitles Error:", err.message);
}

try {
    const movieDownloads = await sdk.getDownloads("155");
    console.log("Movie Downloads:", movieDownloads);
} catch (err) {
    console.error("Movie Downloads Error:", err.message);
}

try {
    const tvDownloads = await sdk.getDownloads("1399", "1", "1");
    console.log("TV Downloads:", tvDownloads);
} catch (err) {
    console.error("TV Downloads Error:", err.message);
}

try {
    const movieResult = await sdk.getStream("cinejoy", "155");
    console.log("Movie Stream:", movieResult);
} catch (err) {
    console.error("Movie Stream Error:", err.message);
}

try {
    const tvResult = await sdk.getStream("cinejoy", "1399", "1", "1");
    console.log("TV Stream:", tvResult);
} catch (err) {
    console.error("TV Stream Error:", err.message);
}

try {
    const tvSubs = await sdk.getSubtitles("1399", "1", "1");
    console.log("TV Subtitles Count:", tvSubs.length);
    console.log("First TV Subtitle Sample:", tvSubs[0] || "None");
} catch (err) {
    console.error("TV Subtitles Error:", err.message);
}
