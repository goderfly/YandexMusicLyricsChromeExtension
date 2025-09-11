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
        requestLyrics(query)
            .then(insertLyricsInDiv)
            .catch(() => {});
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

function requestLyrics(songName) {
    return new Promise((resolve, reject) => {
        const message = { type: "FindLyrics", query: songName };
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            resolve(response);
        });
    });
}

function insertLyricsInDiv(htmlString) {
    const sample = (htmlString || '').slice(0, 50).trim().toLowerCase();
    if (sample.startsWith('<!doctype html')) {
        return;
    }
    const container = document.querySelector('[class^="VibeBlock_root__"][class*="MainPage_vibe__"]') ||
        document.querySelector('[class^="VibeBlock_root__"]');
    if (!container) {
        return;
    }
    // Удаляем шапку LyricsHeader__Container* из приходящего HTML перед вставкой
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlString || '';
    const headers = tmp.querySelectorAll('[class^="LyricsHeader__Container"]');
    headers.forEach((el) => el.remove());
    // Удаляем стили: inline style и style-теги, а также классы
    const styleTags = tmp.querySelectorAll('style');
    styleTags.forEach((el) => el.remove());
    const styledNodes = tmp.querySelectorAll('[style]');
    styledNodes.forEach((el) => el.removeAttribute('style'));
    const classedNodes = tmp.querySelectorAll('[class]');
    classedNodes.forEach((el) => el.removeAttribute('class'));
    const cleanedHtml = tmp.innerHTML;
    // Удалим предыдущий наш блок, если он уже добавлен
    const existing = container.querySelector('#ym-lyrics');
    if (existing) {
        existing.remove();
    }
    // Добавим новый блок с лирикой
    const wrapper = document.createElement('div');
    wrapper.id = 'ym-lyrics';
    wrapper.style.position = 'absolute';
    wrapper.style.right = '0';
    wrapper.style.top = '10px';
    wrapper.style.scrollbarWidth = 'none';   
    wrapper.style.maxWidth = '25%';
    wrapper.style.maxHeight = '650px';
    wrapper.style.overflowY = 'auto';
    wrapper.innerHTML = cleanedHtml;
    container.appendChild(wrapper);
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