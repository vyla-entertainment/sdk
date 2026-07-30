import VylaSDK from "../src/sdk.js";
// import dotenv from "dotenv";
// dotenv.config();

const BACKROOMS = '1083381';

const sdk = new VylaSDK({
    tmdbApiKey: process.env.TMDB_API_KEY
});

const sources = sdk.getSources(true);
const source = sources.find(s => s.key === 'goated');

const result = await sdk.getStream(source.key, BACKROOMS);
console.log("Result:", result);