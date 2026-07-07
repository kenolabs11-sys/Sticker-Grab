(function () {
    'use strict';

    // lives on tiktok.com/messages - scrapes sticker urls off the page and shows the picker overlay

    // tiktok shuffles cdn subdomains every so often. if the button stops finding anything,
    // open devtools on a chat with stickers, check the img src/srcset, and drop the new fragment below
    const DOMAINS = [
        'p16-tiktok-dm-sticker',
        'tos-alisg',
        'tplv-dhq',
        'tplv-gi79', // this one only started showing up after a tiktok update
        'sticker-sign',
    ];

    const log = (...args) => console.log('%c[StickerGrab]', 'color:#ff0050;font-weight:bold', ...args);

    injectStyles();

    let toastTimer = 0;

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #sg-fab{position:fixed;bottom:25px;right:25px;z-index:2147483646;
                background:#ff0050;color:#fff;border:none;padding:13px 20px;border-radius:50px;
                font:600 14px/1 system-ui,sans-serif;cursor:pointer;
                box-shadow:0 4px 18px rgba(255,0,80,.45);transition:transform .15s,box-shadow .15s}
            #sg-fab:hover{transform:translateY(-2px);box-shadow:0 6px 22px rgba(255,0,80,.55)}
            #sg-fab:disabled{opacity:.7;cursor:default;transform:none}

            #sg-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);
                display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
            #sg-panel{width:min(720px,92vw);max-height:86vh;display:flex;flex-direction:column;
                background:#1c1c22;color:#f1f1f3;border-radius:16px;overflow:hidden;
                box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:system-ui,sans-serif}

            #sg-head{display:flex;align-items:center;gap:12px;padding:16px 20px;
                border-bottom:1px solid #2c2c34}
            #sg-title{font-size:16px;font-weight:700;flex:1}
            #sg-count{font-size:13px;color:#9a9aa3}
            .sg-link{background:none;border:none;color:#ff4d7d;font:600 13px/1 system-ui;
                cursor:pointer;padding:4px 6px}
            .sg-link:hover{text-decoration:underline}
            #sg-x{background:none;border:none;color:#9a9aa3;font-size:22px;cursor:pointer;line-height:1}

            #sg-grid{padding:16px 20px;overflow-y:auto;display:grid;
                grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:12px}
            .sg-item{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;
                background:#26262e;cursor:pointer;border:2px solid transparent;transition:border .12s}
            .sg-item img{width:100%;height:100%;object-fit:contain;display:block}
            .sg-item.sel{border-color:#ff0050}
            .sg-check{position:absolute;top:5px;left:5px;width:20px;height:20px;border-radius:6px;
                background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;
                font-size:13px;color:#fff}
            .sg-item.sel .sg-check{background:#ff0050}
            .sg-badge{position:absolute;bottom:0;left:0;right:0;font-size:9px;text-align:center;
                padding:2px;background:rgba(0,0,0,.55);color:#cfcfd6;letter-spacing:.3px}

            #sg-foot{padding:14px 20px;border-top:1px solid #2c2c34}
            .sg-foot-row{display:flex;align-items:center;gap:12px}
            #sg-status{font-size:13px;color:#9a9aa3;flex:1}
            #sg-go{background:#ff0050;color:#fff;border:none;padding:11px 20px;border-radius:10px;
                font:700 14px/1 system-ui;cursor:pointer;white-space:nowrap}
            #sg-go:disabled{opacity:.5;cursor:default}

            #sg-toast{position:fixed;right:24px;bottom:92px;z-index:2147483647;max-width:min(360px,calc(100vw - 48px));
                border:1px solid rgba(255,0,80,.28);border-radius:12px;padding:12px 14px;
                background:#1c1c22;color:#f1f1f3;box-shadow:0 18px 50px rgba(0,0,0,.38);
                font:700 13px/1.45 system-ui,sans-serif;opacity:0;transform:translateY(8px);
                pointer-events:none;transition:opacity .16s,transform .16s}
            #sg-toast.show{opacity:1;transform:none}
        `;
        document.head.appendChild(style);
    }

    function showToast(message) {
        let toast = document.getElementById('sg-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sg-toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('show'), 4200);
    }

    // zip writer, store method only (no deflate) - this is only a fallback path for when the
    // desktop app isn't running, so didn't feel like pulling in jszip for it. ~60 lines, works fine
    const CRC = (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function buildZip(files) {
        const enc = new TextEncoder();
        const localParts = [];
        const centralParts = [];
        const entries = [];
        let offset = 0;

        for (const file of files) {
            const name = enc.encode(file.name);
            const crc = crc32(file.data);
            const size = file.data.length;
            const local = new Uint8Array(30 + name.length);
            const dv = new DataView(local.buffer);

            dv.setUint32(0, 0x04034b50, true);
            dv.setUint16(4, 20, true);
            dv.setUint32(14, crc, true);
            dv.setUint32(18, size, true);
            dv.setUint32(22, size, true);
            dv.setUint16(26, name.length, true);
            local.set(name, 30);

            localParts.push(local, file.data);
            entries.push({ name, crc, size, offset });
            offset += local.length + size;
        }

        let cdSize = 0;
        for (const entry of entries) {
            const central = new Uint8Array(46 + entry.name.length);
            const dv = new DataView(central.buffer);

            dv.setUint32(0, 0x02014b50, true);
            dv.setUint16(4, 20, true);
            dv.setUint16(6, 20, true);
            dv.setUint32(16, entry.crc, true);
            dv.setUint32(20, entry.size, true);
            dv.setUint32(24, entry.size, true);
            dv.setUint16(28, entry.name.length, true);
            dv.setUint32(42, entry.offset, true);
            central.set(entry.name, 46);

            centralParts.push(central);
            cdSize += central.length;
        }

        const eocd = new Uint8Array(22);
        const dv = new DataView(eocd.buffer);
        dv.setUint32(0, 0x06054b50, true);
        dv.setUint16(8, entries.length, true);
        dv.setUint16(10, entries.length, true);
        dv.setUint32(12, cdSize, true);
        dv.setUint32(16, offset, true);

        return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
    }

    // only handling the DM inbox for now, might add the comments section later
    const pageMode = () => {
        const path = location.pathname;
        if (path.startsWith('/messages')) return 'dm';
        return null;
    };

    function isStickerUrl(url) {
        return DOMAINS.some(part => url.includes(part));
    }

    function absoluteUrl(url) {
        if (!url) return '';
        try {
            return new URL(url, location.href).href;
        } catch {
            return url;
        }
    }

    function addStickerUrl(urls, url) {
        const fullUrl = absoluteUrl(url);
        if (fullUrl && isStickerUrl(fullUrl)) urls.add(fullUrl);
    }

    function imageUrls(img) {
        const urls = [img.currentSrc, img.src];
        const srcset = img.getAttribute('srcset') || '';

        for (const part of srcset.split(',')) {
            const url = part.trim().split(/\s+/)[0];
            if (url) urls.push(url);
        }

        return urls.filter(Boolean);
    }

    function backgroundUrls(el) {
        const bg = getComputedStyle(el).backgroundImage;
        if (!bg || bg === 'none') return [];

        const urls = [];
        bg.replace(/url\((["']?)(.*?)\1\)/g, (_, _quote, url) => {
            if (url) urls.push(url);
            return '';
        });
        return urls;
    }

    function scanDmStickers() {
        const urls = new Set();

        document.querySelectorAll('img').forEach(img => {
            imageUrls(img).forEach(url => addStickerUrl(urls, url));
        });

        // some stickers render as a css background instead of an <img>, so the img-only
        // pass above misses them - this second pass catches those
        document.querySelectorAll('*').forEach(el => {
            backgroundUrls(el).forEach(url => addStickerUrl(urls, url));
        });

        return [...urls];
    }

    function scan() {
        return scanDmStickers();
    }

    function emptyMessage() {
        return 'No stickers detected. Scroll up through the chat to load them, then try again.';
    }

    // rough heuristic based on url patterns, not perfect but good enough to label the grid
    function typeOf(url) {
        if (url.includes('video2sticker')) return 'animated';
        if (url.includes('-full')) return 'sticker';
        if (url.includes('sticker-set-frame')) return 'frame';
        if (url.includes('photo-comment')) return 'photo';
        return 'image';
    }

    async function fetchBytes(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const buffer = await response.arrayBuffer();
            return new Uint8Array(buffer);
        } catch {
            throw new Error('Network or CORS error');
        }
    }

    // a bit hacky (strips tiktok's ~tplv suffix, forces a real extension) but it's held up fine
    function cleanName(url, i) {
        let name = (url.split('/').pop() || `sticker_${i}`).split('?')[0].replace(/~tplv.*$/, '');
        if (!/\.(webp|png|jpg|jpeg|gif)$/i.test(name)) name += '.webp';
        return `${String(i + 1).padStart(2, '0')}_${name.replace(/\.awebp$/i, '.webp')}`;
    }

    function saveBlob(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stickergrab_${Date.now()}.zip`;
        a.style.display = 'none';

        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            a.remove();
            URL.revokeObjectURL(url);
        }, 10000);
    }

    function buildBridgePayload(urls) {
        return {
            source: 'tiktok',
            pageUrl: location.href,
            exportedAt: new Date().toISOString(),
            stickers: urls.map((url, index) => ({
                url,
                type: typeOf(url),
                name: cleanName(url, index),
                index,
            })),
        };
    }

    async function sendToApp(urls) {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'stickergrab:send-to-app',
                payload: buildBridgePayload(urls),
            }, message => {
                const runtimeError = chrome.runtime.lastError;

                if (runtimeError) {
                    reject(new Error(runtimeError.message));
                    return;
                }

                resolve(message);
            });
        });

        if (!response?.ok) throw new Error(response?.error || 'StickerGrab app bridge unavailable');
        return response.result;
    }

    // went with 4 - pushing more parallel fetches than that and tiktok's cdn started
    // throwing sporadic 403s on some of the requests when I was testing this
    const ZIP_WORKERS = 4;

    async function downloadZipFallback(picked, statusEl, goBtn) {
        const files = [];
        const used = new Set();
        let ok = 0;
        let fail = 0;
        let idx = 0;

        async function worker() {
            while (idx < picked.length) {
                const i = idx++;
                try {
                    const bytes = await fetchBytes(picked[i]);
                    let name = cleanName(picked[i], i);
                    while (used.has(name)) name = '_' + name;
                    used.add(name);
                    files.push({ name, data: bytes });
                    ok++;
                } catch (error) {
                    fail++;
                    log('failed:', picked[i].slice(0, 50), error?.message || String(error));
                }
                statusEl.textContent = `Downloading ${ok + fail} / ${picked.length}` + (fail ? ` · ${fail} failed` : '');
            }
        }

        await Promise.all(Array.from({ length: ZIP_WORKERS }, worker));

        if (!files.length) {
            statusEl.textContent = `All downloads failed (${fail}).`;
            goBtn.disabled = false;
            return false;
        }

        statusEl.textContent = 'Packing ZIP...';
        const zip = buildZip(files);
        saveBlob(zip);
        statusEl.textContent = `Done - ${ok} saved${fail ? `, ${fail} failed` : ''} · ${(zip.size / 1048576).toFixed(1)} MB`;
        goBtn.textContent = '✓ Downloaded';
        log('ZIP fallback complete:', ok, 'saved,', fail, 'failed');
        return true;
    }

    function mountButton() {
        if (!pageMode() || document.getElementById('sg-fab')) return;

        const fab = document.createElement('button');
        fab.id = 'sg-fab';
        fab.textContent = 'Export Stickers';
        document.body.appendChild(fab);

        fab.onclick = () => {
            const urls = scan();
            log(urls.length + ' stickers found');

            if (!urls.length) {
                showToast(emptyMessage());
                return;
            }

            openPanel(urls, fab);
        };
    }

    function openPanel(urls, fab) {
        const selected = new Set(urls.map((_, i) => i));
        const overlay = document.createElement('div');
        overlay.id = 'sg-overlay';
        overlay.innerHTML = `
            <div id="sg-panel">
                <div id="sg-head">
                    <div id="sg-title">StickerGrab</div>
                    <span id="sg-count"></span>
                    <button class="sg-link" id="sg-all">Select all</button>
                    <button class="sg-link" id="sg-none">Clear</button>
                    <button id="sg-x" title="Close">×</button>
                </div>
                <div id="sg-grid"></div>
                <div id="sg-foot">
                    <div class="sg-foot-row">
                        <span id="sg-status">Tip: animated stickers play in the preview below.</span>
                        <button id="sg-go">Export</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const grid = overlay.querySelector('#sg-grid');
        const countEl = overlay.querySelector('#sg-count');
        const goBtn = overlay.querySelector('#sg-go');
        const statusEl = overlay.querySelector('#sg-status');

        const updateCount = () => {
            countEl.textContent = `${selected.size} / ${urls.length} selected`;
            goBtn.disabled = selected.size === 0;
            goBtn.textContent = selected.size ? `Export (${selected.size})` : 'Export';
        };

        urls.forEach((url, i) => {
            const item = document.createElement('div');
            item.className = 'sg-item sel';
            item.innerHTML = `
                <div class="sg-check">✓</div>
                <img loading="lazy" src="${url}" alt="">
                <div class="sg-badge">${typeOf(url)}</div>`;
            item.onclick = () => {
                const check = item.querySelector('.sg-check');
                if (selected.has(i)) {
                    selected.delete(i);
                    item.classList.remove('sel');
                    check.textContent = '';
                } else {
                    selected.add(i);
                    item.classList.add('sel');
                    check.textContent = '✓';
                }
                updateCount();
            };
            grid.appendChild(item);
        });
        updateCount();

        const close = () => overlay.remove();
        overlay.querySelector('#sg-x').onclick = close;
        overlay.onclick = event => {
            if (event.target === overlay) close();
        };

        overlay.querySelector('#sg-all').onclick = () => {
            urls.forEach((_, i) => selected.add(i));
            grid.querySelectorAll('.sg-item').forEach(el => {
                el.classList.add('sel');
                el.querySelector('.sg-check').textContent = '✓';
            });
            updateCount();
        };

        overlay.querySelector('#sg-none').onclick = () => {
            selected.clear();
            grid.querySelectorAll('.sg-item').forEach(el => {
                el.classList.remove('sel');
                el.querySelector('.sg-check').textContent = '';
            });
            updateCount();
        };

        goBtn.onclick = async () => {
            const picked = [...selected].sort((a, b) => a - b).map(i => urls[i]);
            goBtn.disabled = true;
            fab.disabled = true;

            try {
                statusEl.textContent = 'Sending to StickerGrab app...';
                const result = await sendToApp(picked);
                statusEl.textContent = `Sent to StickerGrab - ${result.inserted} new, ${result.duplicates || 0} duplicate, ${result.failed || 0} failed, ${result.total} total`;
                goBtn.textContent = '✓ Sent';
                log('sent to app:', result.inserted, 'new,', result.total, 'total');
            } catch (error) {
                log('app bridge unavailable, falling back to ZIP:', error?.message || String(error));
                statusEl.textContent = 'StickerGrab app unavailable. Downloading ZIP...';
                await downloadZipFallback(picked, statusEl, goBtn);
            }

            fab.disabled = false;
        };
    }

    mountButton();
    log('ready · v2.0');
})();
