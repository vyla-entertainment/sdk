# vyla/sdk
VylaSDK is a javascript base version of [Vyla](https://vyla.mintlify.app/)'s stream & scrape api, allowing developers to access content providers directly without using a REST api. This gives you the power & updates of Vyla without the headaches of api keys & server reliability.

## Installing
To start, install VylaSDK through npm or pnpm:
```bash
# npm
npm install @vyla-entertainment/sdk

# pnpm
pnpm install @vyla-entertainment/sdk
```

## Usage
Start by creating a VylaSDK element with your TMDB api key.
```js
import VylaSDK from "@vyla-entertainment/sdk";

const sdk = new VylaSDK({
    tmdbApiKey: ...
});
```

You can now use this to access Vyla's content.
```js
// Get sources
// Args: excludeDisabled
sdk.getSources(false);

// Get subtitles
// Args: tmdb id, season?, episode?
await sdk.getSubtitles('0000000', null, null); -> {label, file, type, source}[]

// Probe & test a source
// Args: source key
await sdk.probeSource('nebula'); -> {ok, ms}

// Probe & test all sources
await sdk.probeAllSources(); -> {'key': {ok, ms}, ...}
```