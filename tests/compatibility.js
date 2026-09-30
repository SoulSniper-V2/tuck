// Native compatibility suite. This file is not distributed in the extension ZIP.
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

export const METRICS = {};
const uuid = 'tuck@tuck-extension';

function getExtension() {
    return Extension.lookupByUUID(uuid);
}

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
    console.log(`TUCK COMPAT PASS: ${message}`);
}

function virtualDevice(type) {
    const backend = global.stage.context ? global.stage.context.get_backend() : Clutter.get_default_backend();
    return backend.get_default_seat ? backend.get_default_seat().create_virtual_device(type)
        : Clutter.DeviceManager.get_default().create_virtual_device(type);
}

function press(keyboard, keys) {
    for (const key of keys)
        keyboard.notify_keyval(GLib.get_monotonic_time(), key, Clutter.KeyState.PRESSED);
    for (const key of [...keys].reverse())
        keyboard.notify_keyval(GLib.get_monotonic_time(), key, Clutter.KeyState.RELEASED);
}

export function init() {
    const pointer = virtualDevice(Clutter.InputDeviceType.POINTER_DEVICE);
    pointer.notify_absolute_motion(GLib.get_monotonic_time(), 640, 360);
    // Shell imports automation modules asynchronously before connecting its
    // startup-complete handler. A fast headless session can finish first.
    if (Main.layoutManager._startingUp === false) {
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            Scripting.runPerfScript({run, METRICS});
            return GLib.SOURCE_REMOVE;
        });
    }
}

export async function run() {
    await Scripting.sleep(1800);
    Main.overview.hide();
    await Scripting.sleep(500);
    const extension = getExtension();
    assert(extension && extension._store, 'packaged extension enabled');
    const shelf = extension._shelf;
    const store = extension._store;
    const keyboard = virtualDevice(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    shelf.toggle();
    await Scripting.sleep(300);
    assert(shelf.menu.isOpen && shelf._empty.visible, 'empty shelf opens');
    shelf.menu.close();
    for (let i = 0; i < 9; i++)
        await Scripting.createTestWindow({width: 500 + i * 10, height: 360});
    await Scripting.waitTestWindows();
    await Scripting.sleep(400);
    const windows = global.get_window_actors().map(actor => actor.meta_window)
        .filter(window => !window.skip_taskbar);
    assert(windows.length === 9, 'nine real application windows mapped');
    Main.activateWindow(windows[0]);
    await Scripting.sleep(200);
    press(keyboard, [Clutter.KEY_Super_L, Clutter.KEY_Control_L, Clutter.KEY_h]);
    await Scripting.sleep(300);
    assert(store.windows.includes(windows[0]), 'park shortcut receives real Mutter keyboard input');
    store.restore(windows[0]);
    press(keyboard, [Clutter.KEY_Super_L, Clutter.KEY_Control_L, Clutter.KEY_space]);
    await Scripting.sleep(300);
    assert(shelf.menu.isOpen, 'shelf shortcut opens popup');
    press(keyboard, [Clutter.KEY_Escape]);
    await Scripting.sleep(200);
    assert(!shelf.menu.isOpen, 'Escape closes popup');
    for (const window of windows)
        assert(store.park(window), 'normal window parked');
    assert(windows.every(window => window.minimized), 'owned windows minimized');
    shelf.toggle();
    await Scripting.sleep(400);
    assert(shelf._list.get_n_children() === 9 && shelf._list.height > 0, 'scroll view allocates all nine rows');
    const first = shelf._rowControls.get(windows[0]).restore;
    assert(first.height > 0 && first.width > 0, 'thumbnail row has visible allocation');
    assert(first.child.get_child_at_index(1).width > 50, 'window title and details have readable allocation');
    const thumbnail = first.child.get_first_child();
    assert(thumbnail._clone && thumbnail._clone.width > 0, 'real compositor thumbnail has allocation');
    press(keyboard, [Clutter.KEY_Down]);
    await Scripting.sleep(150);
    assert(global.stage.get_key_focus()._tuckWindow === windows[0], 'Down focuses first result');
    press(keyboard, [Clutter.KEY_Down]);
    await Scripting.sleep(100);
    assert(global.stage.get_key_focus()._tuckWindow === windows[1], 'Down browses to next window');
    press(keyboard, [Clutter.KEY_Up]);
    await Scripting.sleep(100);
    assert(global.stage.get_key_focus()._tuckWindow === windows[0], 'Up browses to previous window');
    press(keyboard, [Clutter.KEY_Up]);
    await Scripting.sleep(100);
    assert(global.stage.get_key_focus() === shelf._search.clutter_text, 'Up from first window returns to search');
    press(keyboard, [Clutter.KEY_Down]);
    await Scripting.sleep(100);
    shelf._rowControls.get(windows[0]).here.grab_key_focus();
    await Scripting.sleep(550);
    assert(shelf._tooltip.visible && shelf._tooltip.text === 'Bring Here', 'keyboard focus reveals secondary action tooltip');
    press(keyboard, [Clutter.KEY_Control_L, Clutter.KEY_f]);
    await Scripting.sleep(100);
    assert(global.stage.get_key_focus() === shelf._search.clutter_text, 'Ctrl+F returns to search');
    press(keyboard, [Clutter.KEY_Down]);
    await Scripting.sleep(100);
    for (let i = 0; i < 16; i++) {
        press(keyboard, [Clutter.KEY_Tab]);
        await Scripting.sleep(50);
    }
    assert(global.stage.get_key_focus()._tuckWindow === windows[8], 'Tab reaches ninth window');
    const adjustment = shelf._scroll.get_vadjustment ? shelf._scroll.get_vadjustment() : shelf._scroll.vscroll.adjustment;
    assert(adjustment.value > 0, 'keyboard focus scrolls last row into view');
    shelf._search.grab_key_focus();
    press(keyboard, [Clutter.KEY_n]);
    await Scripting.sleep(100);
    assert(shelf._search.get_text() === 'n', 'search receives keyboard typing');
    assert(!!shelf._search.secondary_icon, 'query exposes clear search action');
    press(keyboard, [Clutter.KEY_Escape]);
    await Scripting.sleep(100);
    assert(shelf.menu.isOpen && shelf._search.get_text() === '', 'Escape clears query before closing shelf');
    assert(!shelf._search.secondary_icon, 'empty query hides clear action');
    shelf._search.set_text('clear me');
    shelf._search.emit('secondary-icon-clicked');
    assert(shelf._search.get_text() === '', 'clear search control removes query');
    shelf._search.set_text('unmatchable-title-4829');
    assert(shelf._empty.visible && shelf._list.get_n_children() === 0, 'search no-results state');
    shelf._search.set_text('');
    extension._settings.set_boolean('show-previews', false);
    assert(shelf._list.get_n_children() === 9, 'preview setting switches to icons');
    extension._settings.set_boolean('show-previews', true);
    shelf._search.grab_key_focus();
    press(keyboard, [Clutter.KEY_Return]);
    await Scripting.sleep(200);
    assert(!windows[0].minimized && !shelf.menu.isOpen, 'Enter restores first result');
    assert(shelf._list.get_n_children() === 0, 'closing popup releases thumbnail actors');
    assert(!shelf._tooltip.visible && shelf._tooltipSource === 0, 'closing popup cancels and hides tooltip');
    windows[1].unminimize();
    assert(store.windows.length === 7, 'external restore releases ownership');
    const original = windows[2].get_workspace();
    const target = global.workspace_manager.get_workspace_by_index(1);
    target.activate(global.get_current_time());
    await Scripting.sleep(300);
    store.restore(windows[2]);
    await Scripting.sleep(300);
    assert(windows[2].get_workspace() === original, 'restore preserves original workspace');
    target.activate(global.get_current_time());
    await Scripting.sleep(300);
    shelf.toggle();
    await Scripting.sleep(200);
    shelf._rowControls.get(windows[3]).restore.grab_key_focus();
    press(keyboard, [Clutter.KEY_Shift_L, Clutter.KEY_Return]);
    await Scripting.sleep(150);
    assert(windows[3].get_workspace() === target && !windows[3].minimized && !shelf.menu.isOpen,
        'Shift+Enter brings the selected window to the active workspace');
    store.restoreAll();
    assert(windows.every(window => !window.minimized), 'restore all reveals every owned window');
    const path = GLib.get_user_data_dir() + '/gnome-shell/extensions/' + uuid;
    const modern = !!Extension;
    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    if (GLib.getenv('WAYLAND_DISPLAY'))
        launcher.setenv('WAYLAND_DISPLAY', GLib.getenv('WAYLAND_DISPLAY'), true);
    const args = modern ? ['/usr/bin/gjs', '-m', '/tmp/tuck/tests/compatibilityPreferences.js', path]
        : ['/usr/bin/gjs', '/tmp/tuck/tests/classicPreferences.js', path];
    const resultPath = GLib.build_filenamev([GLib.get_tmp_dir(), 'tuck-prefs-' + GLib.uuid_string_random()]);
    launcher.setenv('TUCK_PREFERENCES_RESULT', resultPath, true);
    const preferences = launcher.spawnv(args);
    let finished = false;
    let failure = null;
    preferences.wait_check_async(null, (process, result) => {
        try {
            process.wait_check_finish(result);
        } catch (error) {
            failure = error;
        } finally {
            finished = true;
        }
    });
    for (let attempt = 0; attempt < 100 && !finished; attempt++)
        await Scripting.sleep(100);
    assert(finished && !failure && GLib.file_test(resultPath, GLib.FileTest.EXISTS), 'native preferences and shortcut suite passed');
    Gio.File.new_for_path(resultPath).delete(null);
    store.park(windows[0]);
    windows[1].minimize();
    extension.disable();
    assert(!windows[0].minimized, 'disable restores owned windows');
    assert(windows[1].minimized, 'disable preserves ordinary minimize');
    assert(!Main.panel.statusArea[uuid], 'disable removes indicator');
    extension.enable();
    assert(extension._store.windows.length === 0, 're-enable starts clean');
    extension.disable();
    await Scripting.destroyTestWindows();
    console.log('TUCK COMPATIBILITY SUITE PASSED');
}
