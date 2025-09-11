const token = "Bearer 5TQxk63ZJoaUE2VqBPeVBTejIta4rzgxIl2m-afyCZ10o4RIVCaXbau0IwVhlb3e";

const headers = {
    "Authorization": token,
    "Access-Control-Allow-Origin": "*"
};


function main() {
    chrome.runtime.onMessage.addListener((message, sender, callback) => {
        if (message.type === "FindLyrics") {

            (async () => {
                try {
                    await requestSongPath(message.query, (path) => {
                        requestLyricsDiv(path, (htmlString) => {
                            const firstEntry = htmlString.indexOf("data-lyrics-container=\"true\"") - 5;
                            const lastEntry = htmlString.indexOf("<div class=\"RightSidebar__");
                            const substring = htmlString.substring(firstEntry, lastEntry).replace(/href=/g, "nop");
                            callback(applyCustomCss(substring));
                        });
                    });
                } catch (error) {
                    
                }
            })();
        }
        return true;
    });
}

function applyCustomCss(str) {
    return str.replace(/<div data-/g, "<div style=" +
        "\"font-weight: 400; " +
        "font-family: 'YSTextMedium';" +
        "color: #444444;" +
        "letter-spacing: 0.4px;" +
        "padding: 32px;\"" +
        " data-");
}

function requestSongPath(query, onFetch) {
    fetch(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
        headers: headers
    }).then(async (res) => {
        try {
            const json = await res.json();
            const first = json?.response?.hits?.[0]?.result || {};
            const apiPath = first.api_path || '';
            const pagePath = first.path || '';
            onFetch(pagePath);
        } catch (e) {
            const text = await res.text();
            const startPath = text.indexOf("\"path\":\"") + 8;
            const endPath = text.indexOf("\",\"primary_art\"");
            const path = text.substring(startPath, endPath);
            onFetch(path);
        }
    }).catch(error => {
        
    });
}

function requestLyricsDiv(path, onFetch) {
    fetch(`https://genius.com${path}`, {
        headers: headers
    }).then(res => {
        res.text().then(text => {
            onFetch(text);
        });
    }).catch(error => {
        
    });
}

// Инициализация
main();