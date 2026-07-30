// usage: npm test
// Configure the variables below to customize your testing environment

import fs from "fs";
import path from "path";
import VylaSDK from "../src/sdk.js";
import dotenv from "dotenv";
dotenv.config();

const sdk = new VylaSDK({
    tmdbApiKey: process.env.TMDB_API_KEY
});

console.log("Starting...");

if (CONFIG.TEST_SUBTITLE && CONFIG.TEST_TV) {
    try {
        console.log(`\nTV Subtitles for ID: ${CONFIG.TV_ID} (S${CONFIG.TV_SEASON}E${CONFIG.TV_EPISODE})`);
        const tvSubs = await sdk.getSubtitles(CONFIG.TV_ID, CONFIG.TV_SEASON, CONFIG.TV_EPISODE);
        console.log("TV Subtitles Count:", tvSubs.length);
        console.log("First TV Subtitle Sample:", tvSubs[0] || "None");
    } catch (err) {
        console.error("TV Subtitles Error:", err.message);
    }
} else {
    console.log("\nSkipped Subtitles Test");
}

if (CONFIG.TEST_SUBTITLE && CONFIG.TEST_MOVIE) {
    try {
        console.log(`\nMovie Subtitles for ID: ${CONFIG.MOVIE_ID}`);
        const movieSubs = await sdk.getSubtitles(CONFIG.MOVIE_ID);
        console.log("Movie Subtitles Count:", movieSubs.length);
        console.log("First Subtitle Sample:", movieSubs[0] || "None");
    } catch (err) {
        console.error("Movie Subtitles Error:", err.message);
    }
} else {
    console.log("\nSkipped Subtitles Test");
}

if (CONFIG.TEST_DOWNLOAD && CONFIG.TEST_MOVIE) {
    try {
        console.log(`\nMovie Downloads for ID: ${CONFIG.MOVIE_ID}`);
        const movieDownloads = await sdk.getDownloads(CONFIG.MOVIE_ID);
        console.log("Movie Downloads:", movieDownloads);
    } catch (err) {
        console.error("Movie Downloads Error:", err.message);
    }
} else {
    console.log("\nSkipped Downloads Test");
}

if (CONFIG.TEST_DOWNLOAD && CONFIG.TEST_TV) {
    try {
        console.log(`\nTV Downloads for ID: ${CONFIG.TV_ID} (S${CONFIG.TV_SEASON}E${CONFIG.TV_EPISODE})`);
        const tvDownloads = await sdk.getDownloads(CONFIG.TV_ID, CONFIG.TV_SEASON, CONFIG.TV_EPISODE);
        console.log("TV Downloads:", tvDownloads);
    } catch (err) {
        console.error("TV Downloads Error:", err.message);
    }
} else {
    console.log("\nSkipped Downloads Test");
}

if (CONFIG.TEST_MOVIE) {
    try {
        console.log(`\nMovie Stream from "${CONFIG.STREAM_SOURCE}" for ID: ${CONFIG.MOVIE_ID}`);
        const movieResult = await sdk.getStream(CONFIG.STREAM_SOURCE, CONFIG.MOVIE_ID);
        console.log("Movie Stream:", movieResult);
    } catch (err) {
        console.error("Movie Stream Error:", err.message);
    }
} else {
    console.log("\nSkipped Stream Test");
}

if (CONFIG.TEST_TV) {
    try {
        console.log(`\nTV Stream from "${CONFIG.STREAM_SOURCE}" for ID: ${CONFIG.TV_ID} (S${CONFIG.TV_SEASON}E${CONFIG.TV_EPISODE})`);
        const tvResult = await sdk.getStream(CONFIG.STREAM_SOURCE, CONFIG.TV_ID, CONFIG.TV_SEASON, CONFIG.TV_EPISODE);
        console.log("TV Stream:", tvResult);
    } catch (err) {
        console.error("TV Stream Error:", err.message);
    }
} else {
    console.log("\nSkipped Stream Test");
}
