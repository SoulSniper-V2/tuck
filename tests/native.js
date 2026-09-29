// Run inside GNOME Shell with gnome-shell-test-tool; never included in the extension package.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

export const METRICS = {};

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
    console.log(`TUCK PASS: ${message}`);
}

async function screenshot(name) {
    const directory = GLib.getenv('TUCK_SCREENSHOT_DIR');
    if (!directory)
        return;
    GLib.mkdir_with_parents(directory, 0o755);
    const file = Gio.File.new_for_path(`${directory}/${name}.png`);
    const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
    await new Shell.Screenshot().screenshot(false, stream);
    stream.close(null);
}

export async function run() {
    await Scripting.sleep(1800);
    Main.overview.hide();
    await Scripting.sleep(500);
    const extension = Extension.lookupByUUID('tuck@arushwadhawan');
    assert(extension !== null, 'packaged extension enabled in GNOME Shell');
    const shelf = extension._shelf;
    const store = extension._store;
    shelf.toggle();
    await Scripting.sleep(500);
    assert(shelf.menu.isOpen && shelf._empty.visible, 'empty shelf opens');
    await screenshot('empty');
    shelf.menu.close();

    await Scripting.createTestWindow({width: 800, height: 500});
    await Scripting.createTestWindow({width: 420, height: 600});
    await Scripting.createTestWindow({width: 600, height: 450});
    await Scripting.waitTestWindows();
    await Scripting.sleep(400);
    const windows = global.get_window_actors().map(actor => actor.meta_window);
    assert(windows.length === 3, 'three real test windows mapped');
    for (const window of windows)
        assert(store.park(window), 'real Meta window parked');
    assert(windows.every(window => window.minimized), 'parked windows are minimized');
    shelf.toggle();
    await Scripting.sleep(500);
    assert(shelf._list.get_n_children() === 3, 'shelf shows three entries');
    await screenshot('shelf');

    shelf._search.set_text('not-a-window');
    assert(shelf._empty.visible && shelf._list.get_n_children() === 0, 'no-results state');
    await screenshot('no-results');
    shelf._search.set_text('');
    extension._settings.set_boolean('show-previews', false);
    assert(shelf._list.get_n_children() === 3, 'icon-only mode retains entries');
    await screenshot('icons');
    extension._settings.set_boolean('show-previews', true);

    shelf.menu.close();
    assert(shelf._list.get_n_children() === 0, 'closing popup releases thumbnail actors');
    windows[0].unminimize();
    assert(store.windows.length === 2, 'Alt-Tab-style external restore releases ownership');

    const original = windows[1].get_workspace();
    const target = global.workspace_manager.get_workspace_by_index(1);
    target.activate(global.get_current_time());
    await Scripting.sleep(300);
    store.restore(windows[1], false);
    await Scripting.sleep(300);
    assert(windows[1].get_workspace() === original, 'restore retains original workspace');
    target.activate(global.get_current_time());
    await Scripting.sleep(300);
    store.restore(windows[2], true);
    await Scripting.sleep(300);
    assert(windows[2].get_workspace() === target, 'Bring here moves a real window to the active workspace');

    store.park(windows[0]);
    windows[1].minimize();
    extension.disable();
    assert(!windows[0].minimized, 'disable reveals owned window');
    assert(windows[1].minimized, 'disable leaves ordinary minimized window alone');
    assert(Main.panel.statusArea['tuck@arushwadhawan'] === undefined, 'disable removes panel indicator');
    extension.enable();
    assert(extension._store.windows.length === 0, 're-enable starts with a clean store');
    extension.disable();
    await Scripting.destroyTestWindows();
    console.log('TUCK NATIVE SUITE PASSED');
}
