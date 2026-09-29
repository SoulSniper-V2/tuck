// SPDX-License-Identifier: GPL-3.0-or-later
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {WindowStore} from './windowStore.js';
import {Shelf} from './shell/shelf.js';

export default class TuckExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._store = new WindowStore({
            normalType: Meta.WindowType.NORMAL,
            activate: window => Main.activateWindow(window),
            currentWorkspace: () => global.workspace_manager.get_active_workspace(),
            changed: () => this._shelf.sync(),
        });
        this._shelf = new Shelf(this._store, this._settings, () => this.openPreferences());
        Main.panel.addToStatusArea(this.uuid, this._shelf);
        Main.wm.addKeybinding('park-window', this._settings, Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL, () => this._shelf.parkFocused());
        Main.wm.addKeybinding('open-shelf', this._settings, Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL, () => this._shelf.toggle());
    }

    disable() {
        Main.wm.removeKeybinding('open-shelf');
        Main.wm.removeKeybinding('park-window');
        this._store?.destroy();
        this._store = null;
        this._shelf?.destroy();
        this._shelf = null;
        this._settings = null;
    }
}

