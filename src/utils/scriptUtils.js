
export async function injectScript(timeout) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) return; // No active tab found.


    // Check if the script is already injected
    const [{ result: isInjected }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => !!window.__content_script_injected
    });

    if (!isInjected) {
        console.debug(`[${new Date().toISOString()}] Injecting content script...`);
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content/content.js"],
        });
        chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["content/content.css"]
        });
        // Set a flag in the page's window object to prevent reinjection
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => { window.__content_script_injected = true; }
        });
    }

    return new Promise((resolve, reject) => {
        if (isInjected) resolve();

        const listener = (message, sender) => {
            if (message.action === "dom_selector_ready") {
                chrome.runtime.onMessage.removeListener(listener);
                resolve();
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        // Set a timeout to avoid waiting indefinitely.
        setTimeout(() => {
            chrome.runtime.onMessage.removeListener(listener);
            reject(new Error("Timeout. DomSelector is not ready."));
        }, timeout);
    });
}

export async function getUrl(timeout) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) return; // No active tab found.


    // Set a flag in the page's window object to prevent reinjection
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { window.__content_script_injected = true; }
    });
    const [{ result: url }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.location.href
    });
    return url;
}
