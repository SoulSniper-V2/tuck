// Native GTK/libadwaita fixture. Not part of the distributed extension.
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import {exit, programArgs} from 'system';

Gio.resources_register(Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource'));
imports.package.init({name: 'gnome-shell', prefix: '/usr', libdir: '/usr/lib64'});
String.prototype.format = imports.format.format;
const {extensionManager} = await import('resource:///org/gnome/Shell/Extensions/js/extensionsService.js');
const {ExtensionPrefsDialog} = await import('resource:///org/gnome/Shell/Extensions/js/extensionPrefsDialog.js');
const {serializeExtension} = await import('resource:///org/gnome/Shell/Extensions/js/misc/extensionUtils.js');

const path = programArgs[0];
const [, contents] = Gio.File.new_for_path(`${path}/metadata.json`).load_contents(null);
const metadata = JSON.parse(new TextDecoder().decode(contents));
const extension = extensionManager.createExtensionObject(serializeExtension({metadata, path, type: 2, state: 1}));

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
    console.log(`TUCK PREFS PASS: ${message}`);
}

function sleep(milliseconds) {
    return new Promise(resolve => GLib.timeout_add_once(GLib.PRIORITY_DEFAULT, milliseconds, resolve));
}

function descendants(widget) {
    const result = [widget];
    for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
        result.push(...descendants(child));
    return result;
}

const application = new Adw.Application({application_id: 'org.example.TuckPreferencesTest'});
let failed = false;
application.connect('activate', () => {
    const window = new ExtensionPrefsDialog(extension);
    window.application = application;
    window.connect('loaded', async () => {
        try {
            assert(window.visible_page !== null, 'real preferences page loaded');
            const settings = extension.stateObj.getSettings();
            const widgets = descendants(window);
            const switchRow = widgets.find(widget => widget instanceof Adw.SwitchRow);
            assert(switchRow !== undefined, 'native preview switch exists');
            switchRow.active = false;
            assert(!settings.get_boolean('show-previews'), 'preview switch writes settings');
            switchRow.active = true;
            assert(settings.get_boolean('show-previews'), 'preview switch writes both ways');

            const capture = async (key, keyval, state) => {
                extension.stateObj._capture(window, settings, key, 'Test shortcut');
                await sleep(100);
                const dialog = window.get_visible_dialog();
                assert(dialog instanceof Adw.AlertDialog, 'shortcut capture is a native dialog');
                const controllers = dialog.observe_controllers();
                const controller = Array.from({length: controllers.get_n_items()}, (_, index) => controllers.get_item(index))
                    .find(item => item instanceof Gtk.EventControllerKey);
                controller.emit('key-pressed', keyval, 0, state);
                await sleep(100);
                return dialog;
            };
            const modifiers = Gdk.ModifierType.SUPER_MASK | Gdk.ModifierType.CONTROL_MASK;
            const defaultConflict = await capture('open-shelf', Gdk.KEY_h, modifiers);
            assert(defaultConflict.body.includes('already uses'), 'default accelerator collision ignores modifier ordering');
            defaultConflict.close();
            await sleep(120);
            await capture('park-window', Gdk.KEY_p, modifiers);
            assert(settings.get_strv('park-window')[0] === '<Control><Super>p', 'shortcut capture saves normalized accelerator');
            const duplicate = await capture('open-shelf', Gdk.KEY_p, modifiers);
            assert(duplicate.body.includes('already uses'), 'duplicate Tuck shortcut is rejected');
            duplicate.close();
            await sleep(120);
            const invalid = await capture('park-window', Gdk.KEY_a, 0);
            assert(invalid.body.includes('Include'), 'plain typing is rejected as a shortcut');
            invalid.close();
            await sleep(120);
            await capture('park-window', Gdk.KEY_Escape, 0);
            assert(settings.get_strv('park-window')[0] === '<Control><Super>p', 'Escape leaves shortcut unchanged');
            await capture('park-window', Gdk.KEY_BackSpace, 0);
            assert(settings.get_strv('park-window').length === 0, 'Backspace disables shortcut');
            const reset = widgets.find(widget => widget instanceof Gtk.Button && widget.label === 'Reset');
            reset.emit('clicked');
            assert(settings.get_strv('park-window')[0] === '<Super><Control>h', 'reset restores default shortcut');
            console.log('TUCK PREFERENCES SUITE PASSED');
            GLib.file_set_contents('/tmp/tuck/preferences-ready', 'passed');
            GLib.timeout_add_once(GLib.PRIORITY_DEFAULT, 1800, () => window.close());
        } catch (error) {
            console.error(error.stack);
            failed = true;
            window.close();
        }
    });
    window.present();
});
await application.runAsync([]);
exit(failed ? 1 : 0);
