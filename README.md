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
sdk.getSources(false); -> {key, timeout, label, ...}[]

// Get subtitles
// Args: tmdb id, season?, episode?
await sdk.getSubtitles('0000000', null, null); -> {label, file, type, source}[]

// Probe & test a source
// Args: source key
await sdk.probeSource('nebula'); -> {ok, ms}

// Probe & test all sources
await sdk.probeAllSources(); -> {'key': {ok, ms}, ...}

// Get HLS streams
// Args: source key, tmdb id, season?, episode?, clientIP?
await sdk.getStream('nebula', '0000000', null, null, null) -> {allUrls: {url, quality, label?, server?, type?, skipProxy?, skipVerify?, headers? ...}[]}
```

# [DMCA](https://docs.vyla.cc/misc/dmca)

If your source is listed here, I sincerely apologize. I understand that its inclusion may be costing you a lot of money, and that was never my intention. Please contact me as soon as possible, and I'll remove it ASAP.

This is a small hobby project that I built for learning and personal interest, not for profit. I genuinely want to respect the wishes of source owners and will address any removal requests as quickly as I can.

This project is developed and maintained by [Vyla Entertainment](https://github.com/vyla-entertainment) (@vyla-entertainment).

Original work and core authorship:

[@endoverdosing](https://github.com/EndOverdosing)

[@GavinGoGaming](https://github.com/GavinGoGaming)

Full credits and acknowledgements:
https://docs.vyla.cc/misc/credit
