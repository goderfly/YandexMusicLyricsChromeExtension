const LRCLIB_BASE = "https://lrclib.net/api";
const LRCLIB_HEADERS = {
    "User-Agent": "YandexMusicLyrics/1.2 (https://github.com)"
};

function main() {
    chrome.runtime.onMessage.addListener((message, sender, callback) => {
        if (message.type === "FindLyrics") {
            fetchLyrics(message.artist, message.title, message.query)
                .then((lyrics) => callback(lyrics || ""))
                .catch(() => callback(""));
        }
        return true; // keep callback channel open for async response
    });
}

// Пробуем точный запрос по artist+title, затем поиск по общему запросу
async function fetchLyrics(artist, title, query) {
    // 1. Точный поиск
    if (artist && title) {
        const exact = await tryFetch(
            `${LRCLIB_BASE}/get?artist_name=${enc(artist)}&track_name=${enc(title)}`
        );
        if (exact) return exact;
    }
    // 2. Поиск по свободному запросу
    const results = await trySearchFetch(
        `${LRCLIB_BASE}/search?q=${enc(query)}`
    );
    return results;
}

function extractLyrics(json) {
    if (!json) return null;
    return {
        syncedLyrics: json.syncedLyrics || null,
        plainLyrics: json.plainLyrics || null
    };
}

async function tryFetch(url) {
    try {
        const res = await fetch(url, { headers: LRCLIB_HEADERS });
        if (!res.ok) return null;
        const json = await res.json();
        return extractLyrics(json);
    } catch {
        return null;
    }
}

async function trySearchFetch(url) {
    try {
        const res = await fetch(url, { headers: LRCLIB_HEADERS });
        if (!res.ok) return null;
        const arr = await res.json();
        if (!Array.isArray(arr) || arr.length === 0) return null;
        return extractLyrics(arr[0]);
    } catch {
        return null;
    }
}

function enc(s) {
    return encodeURIComponent(s);
}

// Инициализация
main();
