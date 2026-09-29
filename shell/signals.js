// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit ownership also works before GNOME introduced connectObject().
export class SignalGroup {
    constructor() {
        this._sources = new Map();
    }

    connect(source, name, callback) {
        if (!this._sources.has(source))
            this._sources.set(source, []);
        this._sources.get(source).push(source.connect(name, callback));
    }

    disconnect(source) {
        const ids = this._sources.get(source);
        if (!ids)
            return;
        this._sources.delete(source);
        for (const id of ids)
            source.disconnect(id);
    }

    clear() {
        for (const source of this._sources.keys())
            this.disconnect(source);
    }
}
