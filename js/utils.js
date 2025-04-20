// JS/Utils.js


/**
 * Show a temporary message (TOAST) on the screen.
 * @param {string} message -The message to show.
 * @param {'info'|'success'|'error'} type -The type of message (for CSS styles).
 * @param {number} duration -Duration in milliseconds.
 */
export function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.classList.add('toast-container');
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.classList.add('toast', type); // Add type as a class

    toast.textContent = message;

    toastContainer.appendChild(toast);
    // Little delay to allow CSS transition

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        // Wait for the hide transition to end before eliminating

        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        // Fallback in case the transition does not shoot

        setTimeout(() => toast.remove(), 500);
    }, duration);
}

/**
 * Shorten a URL using an external service (spoo.me in this case).
 * @param {string} urlToShorten -The long url.
 * @returns {Promise<string|undefined>} The short or Undefined URL is error.
 */
export async function shortUrl(urlToShorten) {
    const apiUrl = 'https://spoo.me/';
    const data = new URLSearchParams();
    data.append('url', urlToShorten);

    try {
        let response = await fetch(apiUrl, {
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
        console.error("Error generating shortened URL:", error);
        showToast("Error generating shortened URL", 'error');
        return undefined; // Undefined returns in case of error

    }
}

export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId); // Cancela el temporizador anterior si existe
        timeoutId = setTimeout(() => func.apply(this, args), delay); // Programa una nueva ejecución
    };
}

String.prototype.hashCode = function () {
    var hash = 0, i, chr, len;
    if (this.length === 0) return hash;
    for (i = 0, len = this.length; i < len; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};