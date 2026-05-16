function waitForElement(selector, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                clearTimeout(timerId);
                resolve(el);
            }
        });

        observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });

        const timerId = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element not found: ${selector}`));
        }, timeoutMs);
    });
}

function getText(el) {
    const text = (el?.textContent || "").trim();
    return text;
}

function observeMeta(container) {

    const titleSelector = '[class*="Meta_title__"]';
    const titleContainerSelector = '[class*="Meta_titleContainer__"]';
    const artistsSelector = '[class*="Meta_artists__"]';

    let lastQuery = "";
    let debounceId = null;
    let currentRequestId = 0;

    const buildAndSend = () => {
        const titleEl = container.querySelector(`${titleContainerSelector} ${titleSelector}`) || container.querySelector(titleSelector);
        // артисты могут быть множественными узлами (a/span) — соберём все тексты
        const artistNodes = container.querySelectorAll(`${artistsSelector} a, ${artistsSelector} span, ${artistsSelector}`);
        const title = getText(titleEl);
        const artists = Array.from(artistNodes)
            .map(getText)
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(', ');
        if (!title || !artists) {
            return;
        }
        const query = `${artists} ${title}`;
        if (query === lastQuery) return;
        lastQuery = query;
        clearLyrics();
        const reqId = ++currentRequestId;
        requestLyrics(artists, title, query)
            .then((data) => {
                if (reqId === currentRequestId) insertLyrics(data);
            })
            .catch(() => {});
    };

    // Мгновенно стираем текст при любом изменении метаданных, до debounce
    const clearImmediately = () => {
        const titleEl = container.querySelector(`${titleContainerSelector} ${titleSelector}`) || container.querySelector(titleSelector);
        const title = getText(titleEl);
        const artistNodes = container.querySelectorAll(`${artistsSelector} a, ${artistsSelector} span, ${artistsSelector}`);
        const artists = Array.from(artistNodes).map(getText).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
        const query = `${artists} ${title}`;
        if (query !== lastQuery) clearLyrics();
    };

    // Начальный запуск, если элементы уже есть
    buildAndSend();

    const observer = new MutationObserver((mutations) => {
        // Отслеживаем изменения текста заголовка или структуру внутри контейнера
        let relevant = false;
        for (const m of mutations) {
            if (m.type === 'characterData') {
                const parent = m.target.parentElement;
                if (parent && (parent.matches(titleSelector) || parent.closest(titleSelector) || parent.matches(artistsSelector) || parent.closest(artistsSelector))) {
                    relevant = true;
                    break;
                }
            }
            if (m.type === 'childList') {
                const nodes = [
                    ...Array.from(m.addedNodes || []),
                    ...Array.from(m.removedNodes || [])
                ];
                if (nodes.some((n) => n.nodeType === 1 && (
                    n.matches?.(titleSelector) || n.matches?.(artistsSelector) ||
                    n.querySelector?.(titleSelector) || n.querySelector?.(artistsSelector)
                ))) {
                    relevant = true;
                    break;
                }
            }
            if (m.type === 'attributes' && (m.target.matches?.(titleSelector) || m.target.matches?.(artistsSelector))) {
                relevant = true;
                break;
            }
        }

        if (relevant) {
            clearImmediately();
            if (debounceId) clearTimeout(debounceId);
            debounceId = setTimeout(buildAndSend, 300);
        }
    });

    observer.observe(container, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true
    });
}

function requestLyrics(artist, title, query) {
    return new Promise((resolve, reject) => {
        const message = { type: "FindLyrics", artist, title, query };
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            resolve(response);
        });
    });
}

const TIMECODE_SELECTOR = 'input[aria-label="Управление таймкодом"]';
const LYRICS_STYLES = {
    position: 'absolute',
    right: '0',
    scrollbarWidth: 'none',
    width: '28%',
    overflowY: 'auto',
    overflowX: 'hidden',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    fontWeight: '500',
    fontFamily: "var(--ys-font-family, 'YS Text', 'Helvetica Neue', Arial, sans-serif)",
    fontSize: '14px',
    lineHeight: '1.5',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: '0.3px',
    padding: '16px 24px 100px 24px',
    boxSizing: 'border-box',
    maskImage: 'linear-gradient(to bottom, black 0%, black 80%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 80%, transparent 100%)',
};

let syncTimerId = null;
let resizeObserver = null;

function clearLyrics() {
    if (syncTimerId) { clearInterval(syncTimerId); syncTimerId = null; }
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    const existing = document.querySelector('#ym-lyrics');
    if (existing) existing.remove();
}

// Парсит формат "[mm:ss.xx] текст" в массив {time, text}
function parseSyncedLyrics(synced) {
    if (!synced) return null;
    const lines = [];
    for (const raw of synced.split('\n')) {
        const match = raw.match(/^\[(\d+):(\d+\.?\d*)\]\s?(.*)$/);
        if (!match) continue;
        const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
        const text = match[3];
        lines.push({ time, text });
    }
    return lines.length > 0 ? lines : null;
}

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getPlayerTimeSec() {
    const slider = document.querySelector(TIMECODE_SELECTOR);
    return slider ? parseFloat(slider.value) || 0 : 0;
}

function insertLyrics(data) {
    const syncedLyrics = data?.syncedLyrics || null;
    const plainLyrics = data?.plainLyrics || null;
    const notFound = !syncedLyrics && !plainLyrics;

    const content = document.querySelector('[class*="MainPage_content__"]');
    if (!content) return;

    const pos = getComputedStyle(content).position;
    if (pos === 'static') content.style.position = 'relative';

    clearLyrics();

    const wrapper = document.createElement('div');
    wrapper.id = 'ym-lyrics';
    Object.assign(wrapper.style, LYRICS_STYLES);
    wrapper.style.top = '0';

    // Пересчитываем bottom при resize
    const recalcBottom = () => {
        const header = content.querySelector('[class*="Skeleton_header"]');
        const ch = content.offsetHeight;
        let bottom;
        if (header) {
            const cr = content.getBoundingClientRect();
            const hr = header.getBoundingClientRect();
            bottom = ch - (hr.top - cr.top) - 50;
        } else {
            bottom = 20;
        }
        wrapper.style.bottom = bottom + 'px';
    };
    recalcBottom();
    resizeObserver = new ResizeObserver(recalcBottom);
    resizeObserver.observe(content);

    if (notFound) {
        wrapper.innerHTML = 'Текст песни не найден :(';
        wrapper.style.opacity = '0.5';
        content.appendChild(wrapper);
        return;
    }

    const parsed = parseSyncedLyrics(syncedLyrics);

    if (parsed) {
        // Караоке-режим: каждая строка — отдельный span
        parsed.forEach((line, i) => {
            const span = document.createElement('span');
            span.dataset.idx = i;
            span.style.display = 'block';
            span.style.transition = 'all 0.3s ease';
            span.style.padding = '2px 0';
            span.innerHTML = escapeHtml(line.text) || '&nbsp;';
            wrapper.appendChild(span);
        });
        content.appendChild(wrapper);
        startSyncHighlight(wrapper, parsed);
    } else {
        // Фоллбэк на plain text
        wrapper.innerHTML = escapeHtml(plainLyrics).replace(/\n/g, '<br>');
        content.appendChild(wrapper);
    }
}

function startSyncHighlight(wrapper, lines) {
    let lastIdx = -1;
    const UPDATE_INTERVAL_MS = 300;

    const update = () => {
        const sec = getPlayerTimeSec();
        // Ищем текущую строку: последняя, чьё время <= текущей позиции
        let idx = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].time <= sec) { idx = i; break; }
        }
        if (idx === lastIdx) return;
        lastIdx = idx;

        const spans = wrapper.querySelectorAll('span[data-idx]');
        spans.forEach((span, i) => {
            if (i === idx) {
                span.style.color = 'rgba(255, 255, 255, 1)';
                span.style.fontSize = '16px';
                span.style.fontWeight = '600';
            } else {
                span.style.color = 'rgba(255, 255, 255, 0.7)';
                span.style.fontSize = '14px';
                span.style.fontWeight = '500';
            }
        });

        // Авто-скролл к текущей строке
        if (idx >= 0 && spans[idx]) {
            spans[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    update();
    syncTimerId = setInterval(update, UPDATE_INTERVAL_MS);
}

function main() {
    console.log('[main] init');
    // Ищем устойчиво контейнер метаданных по стабильному префиксу класса
    waitForElement('[class^="Meta_metaContainer__"]').then((node) => {
        console.log('[main] meta container found:', node);
        observeMeta(node);
    }).catch((e) => console.warn(e.message));
}

main();