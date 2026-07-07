'use strict';

// talks to the tauri desktop app over localhost - only works while the app is actually open
const BRIDGE_URL = 'http://127.0.0.1:8765/stickers';
const BRIDGE_TIMEOUT_MS = 60000; // big batches can take a while, no reason to be aggressive here
const log = (...args) => console.log('[StickerGrab]', ...args);

async function postStickersToApp(payload) {
    // if the desktop app is closed, fetch would otherwise just hang - abort and let
    // the caller fall back to the zip export instead
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);

    try {
        const response = await fetch(BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error('Bridge HTTP ' + response.status);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'stickergrab:send-to-app') {
        return false;
    }

    postStickersToApp(message.payload)
        .then((result) => {
            const count = message.payload?.stickers?.length || 0;
            log(`sent ${count} stickers to app OK`, result);
            sendResponse({ ok: true, result });
        })
        .catch((error) => {
            const messageText = error?.message || String(error);
            log('app bridge unreachable, falling back to ZIP', messageText);
            sendResponse({ ok: false, error: messageText });
        });

    return true; // keeps the message channel open for the async sendResponse above
});
