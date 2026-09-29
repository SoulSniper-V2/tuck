// Run inside GNOME Shell with gnome-shell-test-tool; never included in the extension package.
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

export const METRICS = {};

let keyboard;

async function press(keys) {
    for (const key of keys)
        keyboard.notify_keyval(GLib.get_monotonic_time(), key, Clutter.KeyState.PRESSED);
    await Scripting.sleep(80);
    for (const key of [...keys].reverse())
        keyboard.notify_keyval(GLib.get_monotonic_time(), key, Clutter.KeyState.RELEASED);
    await Scripting.sleep(200);
}

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

export function init() {
    console.log('TUCK native harness loaded');
    const pointer = global.stage.context.get_backend().get_default_seat()
        .create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    pointer.notify_absolute_motion(GLib.get_monotonic_time(), 640, 360);
}

export async function run() {
    console.log('TUCK native harness started');
    keyboard = global.stage.context.get_backend().get_default_seat().create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
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
    Main.activateWindow(windows[0]);
    await Scripting.sleep(200);
    await press([Clutter.KEY_Super_L, Clutter.KEY_Control_L, Clutter.KEY_h]);
    assert(store.windows.includes(windows[0]), 'park shortcut works through Mutter keyboard input');
    store.restore(windows[0]);
    await press([Clutter.KEY_Super_L, Clutter.KEY_Control_L, Clutter.KEY_space]);
    assert(shelf.menu.isOpen, 'shelf shortcut opens the popup');
    await press([Clutter.KEY_Escape]);
    assert(!shelf.menu.isOpen, 'Escape closes the popup');
    for (const window of windows)
        assert(store.park(window), 'real Meta window parked');
    assert(windows.every(window => window.minimized), 'parked windows are minimized');
    shelf.toggle();
    await Scripting.sleep(500);
    assert(shelf._list.get_n_children() === 3, 'shelf shows three entries');
    await screenshot('shelf');
    await press([Clutter.KEY_Down]);
    assert(global.stage.get_key_focus()?._tuckWindow === windows[0], 'Down moves from search to the first row');
    windows[0].notify('title');
    assert(global.stage.get_key_focus()?._tuckWindow === windows[0], 'title updates preserve keyboard row focus');
    shelf._search.grab_key_focus();

    await press([Clutter.KEY_Return]);
    assert(!windows[0].minimized && !shelf.menu.isOpen, 'Enter restores the first result and closes the shelf');
    store.park(windows[0]);
    shelf.toggle();
    await Scripting.sleep(200);
    await press([Clutter.KEY_n]);
    await press([Clutter.KEY_o]);
    await press([Clutter.KEY_t]);
    assert(shelf._search.get_text() === 'not', 'search receives real keyboard typing');
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
    assert(shelf._focusedWindow === null, 'empty workspace clears cached application focus');
    store.restore(windows[1], false);
    await Scripting.sleep(300);
    assert(windows[1].get_workspace() === original, 'restore retains original workspace');
    target.activate(global.get_current_time());
    await Scripting.sleep(300);
    store.restore(windows[2], true);
    await Scripting.sleep(300);
    assert(windows[2].get_workspace() === target, 'Bring here moves a real window to the active workspace');

    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    launcher.setenv('WAYLAND_DISPLAY', 'gnome-shell-test-display', true);
    const prefs = launcher.spawnv(['/usr/bin/gjs', '-m', '/tmp/tuck/tests/nativePreferences.js', extension.path]);
    for (let attempt = 0; attempt < 60 && !GLib.file_test('/tmp/tuck/preferences-ready', GLib.FileTest.EXISTS); attempt++)
        await Scripting.sleep(100);
    await screenshot('preferences');
    await new Promise((resolve, reject) => prefs.wait_check_async(null, (process, result) => {
        try {
            process.wait_check_finish(result);
            resolve();
        } catch (error) {
            reject(error);
        }
    }));
    assert(true, 'GTK preferences fixture exited successfully');

    const fixture = launcher.spawnv(['/usr/bin/python3', '/tmp/tuck/tests/nativeWindows.py']);
    await Scripting.sleep(700);
    const documents = global.get_window_actors().map(actor => actor.meta_window)
        .filter(window => window.get_wm_class() === 'org.example.TuckWindowTest');
    assert(documents.length === 9, 'nine real GTK document windows mapped');
    for (const window of documents)
        store.park(window);
    shelf.toggle();
    await Scripting.sleep(300);
    assert(shelf._list.get_n_children() === 9, 'many-window shelf scrolls without dropping entries');
    await press([Clutter.KEY_Down]);
    for (let index = 0; index < 16; index++)
        await press([Clutter.KEY_Tab]);
    assert(global.stage.get_key_focus()?._tuckWindow === shelf._filteredWindows[8], 'Tab reaches the ninth window');
    assert(shelf._scroll.get_vadjustment().value > 0, 'keyboard focus scrolls the last row into view');
    await screenshot('many-windows');
    shelf._search.set_text('cafe resume');
    assert(shelf._filteredWindows.length === 1, 'real Unicode title matches accent-insensitive search');
    const longWindow = shelf._filteredWindows[0];
    assert(shelf._rowControls.get(longWindow).restore.accessible_name.includes(longWindow.get_title()),
        'full long title is retained for accessibility');
    await screenshot('search-long-title');
    shelf.menu.close();
    longWindow.delete(global.get_current_time());
    await Scripting.sleep(200);
    assert(store.windows.length === 8, 'closing a parked real window removes its record');
    store.restoreAll();
    const interfaceSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
    interfaceSettings.set_string('color-scheme', 'prefer-light');
    interfaceSettings.set_double('text-scaling-factor', 1.25);
    for (const window of documents.filter(window => window !== longWindow).slice(0, 3))
        store.park(window);
    shelf.toggle();
    await Scripting.sleep(500);
    assert(shelf.menu.isOpen && shelf._list.get_n_children() === 3, 'light appearance and enlarged text retain the shelf');
    await screenshot('light-large-text');
    shelf.menu.close();
    store.restoreAll();
    fixture.force_exit();
    await Scripting.sleep(200);
    interfaceSettings.reset('text-scaling-factor');

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
