const ALLOWED_ATTRS = {
    a: ["href"],
    img: ["src", "alt"],
    iframe: ["src"]
};


/**
 * Clones the DOM and removes unwanted elements and attributes.
 * @param {HTMLElement} dom
 * @returns {HTMLElement} Cleaned DOM
 */
function cleanDom(dom) {
    const cleaned = dom.cloneNode(true);
    // Remove undesired elements in one go.
    cleaned.querySelectorAll(
        "script, style, noscript, meta, link, aside, .ads, .footer, .header, .sidebar"
    ).forEach(el => el.remove());

    // For every element, remove any attribute that is not explicitly allowed.
    cleaned.querySelectorAll("*").forEach(el => {
        const allowed = ALLOWED_ATTRS[el.tagName.toLowerCase()] || [];
        Array.from(el.attributes).forEach(attr => {
            if (!allowed.includes(attr.name)) {
                el.removeAttribute(attr.name);
            }
        });
    });
    return cleaned;
}


/**
 * Recursively compresses the DOM by collapsing chains of single-element nodes.
 * @param {Node} node
 * @returns {Node} Compressed DOM node
 */
function compressDom(node) {
    if (!node) return null;
    // Collapse nodes that have exactly one element child.
    while (
        node.nodeType === Node.ELEMENT_NODE &&
        node.childNodes.length === 1 &&
        node.firstChild.nodeType === Node.ELEMENT_NODE
    ) {
        node = node.firstChild;
    }
    // Process and replace children recursively.
    Array.from(node.childNodes).forEach(child => {
        const compressedChild = compressDom(child);
        if (compressedChild !== child) {
            node.replaceChild(compressedChild, child);
        }
    });
    return node;
}

/**
 * Recursively converts a DOM node into an array structure.
 * - Text nodes return trimmed text.
 * - Comment nodes return null.
 * - Element nodes return an array of the form: [tagName, children]
 *   where children is an array that may start with an attributes object.
 *
 * Nodes with no meaningful content are pruned (returned as an empty array).
 *
 * @param {Node} node
 * @returns {Array|string|null}
 */
function convertDomToJson(node) {
    if (node.nodeType === Node.COMMENT_NODE) return null;

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        return text || null;
    }

    // For element nodes: record tag and allowed attributes.
    const tagName = node.tagName.toLowerCase();
    const allowedAttrs = ALLOWED_ATTRS[tagName] || [];
    const attrs = {};
    allowedAttrs.forEach(attr => {
        const value = node.getAttribute(attr);
        if (value) {
            attrs[attr] = value;
        }
    });

    // Process children recursively.
    const children = [];
    node.childNodes.forEach(child => {
        const converted = convertDomToJson(child);
        // Only add non-null, non-empty results.
        if (
            converted !== null &&
            !(Array.isArray(converted) && converted.length === 0)
        ) {
            children.push(converted);
        }
    });

    // If attributes exist, prepend them.
    if (Object.keys(attrs).length > 0) {
        children.unshift(attrs);
    }

    // Return an empty array if no content; otherwise return [tagName, children].
    return children.length ? [tagName, children] : [];
}


function createElementFromHTML(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.body.firstElementChild; // Return the first element
}

/**
 * Full pipeline: cleans, compresses, converts to structure, and JSON-encodes.
 * @param {HTMLElement} dom
 * @returns {string} JSON string representing the DOM structure.
 */
export function convertHtmlToCleanCompressedJson(html) {
    const dom = createElementFromHTML(html)
    const cleaned = cleanDom(dom);
    const compressed = compressDom(cleaned);
    const json = convertDomToJson(compressed);
    return json;
}