// SPDX-License-Identifier: GPL-3.0-or-later
/* exported init */
const {Meta, Shell} = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const {WindowStore} = Me.imports.windowStore;
const {Shelf} = Me.imports.shell.shelf;

class TuckExtension {
    enable() {
        this._settings = ExtensionUtils.getSettings();
        this._store = new WindowStore({
            normalType: Meta.WindowType.NORMAL,
            activate: window => Main.activateWindow(window),
            currentWorkspace: () => global.workspace_manager.get_active_workspace(),
            changed: () => this._shelf.sync(),
        });
        this._shelf = new Shelf(this._store, this._settings, () => {
            // Older Shell exposes preferences through a desktop file with extension:// URIs.
            if (ExtensionUtils.openPrefs)
                ExtensionUtils.openPrefs();
            else
                Shell.AppSystem.get_default().lookup_app('gnome-shell-extension-prefs.desktop').get_app_info()
                    .launch_uris([`extension:///${Me.uuid}`], global.create_app_launch_context(global.get_current_time(), -1));
        });
        Main.panel.addToStatusArea(Me.uuid, this._shelf);
        Main.wm.addKeybinding('park-window', this._settings, Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL, () => this._shelf.parkFocused());
        Main.wm.addKeybinding('open-shelf', this._settings, Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL, () => this._shelf.toggle());
    }

    disable() {
        Main.wm.removeKeybinding('open-shelf');
        Main.wm.removeKeybinding('park-window');
        try {
            if (this._store)
                this._store.destroy();
        } finally {
            this._store = null;
            if (this._shelf)
                this._shelf.destroy();
            this._shelf = null;
            this._settings = null;
        }
    }
}

function init() {
    ExtensionUtils.initTranslations();
    return new TuckExtension();
}
