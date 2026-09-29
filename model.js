// SPDX-License-Identifier: GPL-3.0-or-later

function normalize(text) {
    return String(text).normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function matchesQuery(title, appName, query) {
    const haystack = normalize(`${title} ${appName}`);
    return normalize(query).trim().split(/\s+/u).every(term => haystack.includes(term));
}

export function fitPreview(width, height, maxWidth, maxHeight) {
    if (![width, height, maxWidth, maxHeight].every(value => Number.isFinite(value) && value > 0))
        return null;

    const scale = Math.min(maxWidth / width, maxHeight / height);
    return {width: width * scale, height: height * scale, scale};
}

export function canPark(window, normalType) {
    return window !== null &&
        window.get_window_type() === normalType &&
        !window.skip_taskbar &&
        !window.minimized &&
        !window.get_transient_for() &&
        window.can_minimize();
}

