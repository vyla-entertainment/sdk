// usage: npm test
// Configure the variables below to customize your testing environment

import fs from "fs";
import path from "path";
import VylaSDK from "../src/sdk.js";
import dotenv from "dotenv";
dotenv.config();

const CONFIG = {
    DEBUG: true,                 // Set to true to print outgoing requests, headers, formats, and responses

    MOVIE_ID: "550",             // Movie TMDB ID to test
    TV_ID: "37854",               // TV TMDB ID to test, for anime I recommend using a random ID like 37854
    TV_SEASON: "1",              // TV Season to test
    TV_EPISODE: "1",             // TV Episode to test
    STREAM_SOURCE: "",    // Source key to test

    TEST_SUBTITLE: false,         // Toggle subtitle testing
    TEST_DOWNLOAD: false,         // Toggle download testing
    TEST_MOVIE: true,            // Toggle movie testing
    TEST_TV: true                // Toggle TV testing
};

// debug
if (CONFIG.DEBUG) {
    const originalFetch = globalThis.fetch;

    const debugFile = path.resolve("test/debug-output.json");
    fs.mkdirSync(path.dirname(debugFile), { recursive: true });

    const logs = [];

    const save = () => {
        fs.writeFileSync(debugFile, JSON.stringify(logs, null, 2));
    };

    globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input?.url || String(input);

        const request = {
            timestamp: new Date().toISOString(),
            request: {
                url,
                method: init?.method || "GET",
                headers: init?.headers || {},
                body: init?.body || null
            }
        };

        console.log("\nRequest:");
        console.log(`URL:    ${url}`);
        console.log(`Method: ${request.request.method}`);
        if (init?.headers) console.log("Headers:", JSON.stringify(init.headers, null, 2));
        if (init?.body) console.log("Body:", init.body);

        try {
            const response = await originalFetch(input, init);

            request.response = {
                status: response.status,
                statusText: response.statusText
            };

            console.log("\nResponse:");
            console.log(`URL:    ${url}`);
            console.log(`Status: ${response.status} ${response.statusText}`);

            try {
                const clone = response.clone();
                const text = await clone.text();

                try {
                    request.response.format = "json";
                    request.response.body = JSON.parse(text);

                    console.log("Format: JSON");
                    console.log(JSON.stringify(request.response.body, null, 2));
                } catch {
                    request.response.format = "text";
                    request.response.body = text;

                    console.log("Format: Text/HTML");
                    console.log(text.substring(0, 800) + (text.length > 800 ? "..." : ""));
                }
            } catch (err) {
                request.response.body = `<Failed to read response body: ${err.message}>`;
            }

            logs.push(request);
            save();

            return response;
        } catch (err) {
            request.error = err.message;
            logs.push(request);
            save();

            console.log(`URL:   ${url}`);
            console.log(`Error: ${err.message}`);

            throw err;
        }
    };
}

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
