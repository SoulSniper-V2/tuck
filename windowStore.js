// SPDX-License-Identifier: GPL-3.0-or-later
import {canPark} from './model.js';

export class WindowStore {
    constructor({normalType, activate, currentWorkspace, changed}) {
        this._normalType = normalType;
        this._activate = activate;
        this._currentWorkspace = currentWorkspace;
        this._changed = changed;
        this._windows = new Map();
    }

    get windows() {
        return [...this._windows.keys()];
    }

    canPark(window) {
        return !this._windows.has(window) && canPark(window, this._normalType);
    }

    park(window) {
        if (!this.canPark(window))
            return false;

        const signals = [
            window.connect('unmanaged', () => this._forget(window)),
            window.connect('notify::minimized', () => {
                if (!window.minimized)
                    this._forget(window);
            }),
            window.connect('notify::title', () => this._changed()),
            window.connect('workspace-changed', () => this._changed()),
        ];
        this._windows.set(window, signals);

        try {
            window.minimize();
        } catch (error) {
            this._forget(window);
            throw error;
        }

        if (!window.minimized) {
            this._forget(window);
            return false;
        }

        this._changed();
        return true;
    }

    restore(window, bringHere = false) {
        if (!this._windows.has(window))
            return false;

        const workspace = this._currentWorkspace();
        // Keep ownership until a workspace move succeeds so a failed move is recoverable.
        if (bringHere && !window.is_on_all_workspaces())
            window.change_workspace(workspace);

        this._forget(window);
        window.unminimize();
        this._activate(window);
        return true;
    }

    restoreAll() {
        for (const window of this.windows) {
            this._forget(window);
            window.unminimize();
        }
    }

    _forget(window) {
        const signals = this._windows.get(window);
        if (!signals)
            return;

        this._windows.delete(window);
        for (const id of signals)
            window.disconnect(id);
        this._changed();
    }

    destroy() {
        this._changed = () => {};
        this.restoreAll();
        this._activate = null;
        this._currentWorkspace = null;
    }
}

