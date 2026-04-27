// js/utils.js

/**
 * Show a temporary message (TOAST) on the screen.
 * @param {string} message - The message to show.
 * @param {'info'|'success'|'error'} type - The type of message (for CSS styles).
 * @param {number} duration - Duration in milliseconds.
 */
function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.classList.add('toast-container');
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Small delay to allow CSS transition
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        // Wait for the hide transition to end before removing
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        // Fallback
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
    }, duration);
}

/**
 * Shorten a URL using an external service (spoo.me).
 * @param {string} urlToShorten - The long url.
 * @returns {Promise<string|undefined>} The short URL or undefined on error.
 */
async function shortUrl(urlToShorten) {
    const apiUrl = 'https://spoo.me/';
    const data = new URLSearchParams();
    data.append('url', urlToShorten);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: data
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        return result.short_url;
    } catch (error) {
        console.error('Error generating shortened URL:', error);
        return undefined;
    }
}

/**
 * Simple debounce function.
 */
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Simple hash function for strings.
 */
function generateHashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return Math.abs(hash);
}

export { showToast, shortUrl, debounce, generateHashCode };
