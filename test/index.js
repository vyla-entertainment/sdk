import { HEALTH_PROBE_ID } from "../src/config.js";
import VylaSDK from "../src/sdk.js";
import dotenv from "dotenv";
dotenv.config();

const BACKROOMS = '1083381';

const sdk = new VylaSDK({
    tmdbApiKey: process.env.TMDB_API_KEY
});

// 'true' is excludeDisabled
// const sources = sdk.getSources(true);
// const source = sources.find(s => s.key === 'lookmovie');

// const result = await sdk.getStream(source.key, BACKROOMS);
// console.log("Result:", result.allUrls[0].url);

// const tests = {
//     probeAll(log) {
//         const sources = sdk.getSources(true);
//         let index = 0;

//         Promise.all(sources.map(async (source, idx) => {
//             try {
//                 const result = await sdk.probeSource(source.key);
//                 index++;
//                 log(`(${index}/${sources.length}) source #${idx + 1} (${source.label}):`, result);
//             } catch (err) {
//                 log(`Error probing source ${source.key}:`, err);
//             }
//         })).then(() => {
//             log("All sources probed.");
//         });
//     },
//     tryHealthProbe(log) {
//         const sources = sdk.getSources(true);
//         let index = 0;

//         Promise.all(sources.map(async (source, idx) => {
//             try {
//                 const result = await sdk.getStream(source.key, HEALTH_PROBE_ID, null, null, null);
//                 index++;
//                 log(`(${index}/${sources.length}) source #${idx + 1} (${source.label}):`, result?.allUrls?.[0]?.url || result?.url || "no sources :(");
//             } catch (err) {
//                 log(`Error probing source ${source.key}:`, err);
//             }
//         })).then(() => {
//             log("All sources probed.");
//         });
//     }
// }

// tests.tryHealthProbe(console.log);