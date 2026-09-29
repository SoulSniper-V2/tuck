// Native GTK 4/libadwaita fixture, following the Extensions preferences loader.
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import {programArgs} from 'system';
import {checkPreferences} from './preferencesChecks.js';

Gio.resources_register(Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource'));
imports.package.init({name: 'gnome-shell', prefix: '/usr', libdir: '/usr/lib64'});
String.prototype.format = imports.format.format;
const path = programArgs[0];
const [, contents] = Gio.File.new_for_path(`${path}/metadata.json`).load_contents(null);
const metadata = JSON.parse(new TextDecoder().decode(contents));
metadata.path = path;
metadata.dir = Gio.File.new_for_path(path);
const {extensionManager} = await import('resource:///org/gnome/Shell/Extensions/js/extensionsService.js');
const {ExtensionPrefsDialog} = await import('resource:///org/gnome/Shell/Extensions/js/extensionPrefsDialog.js');
const {serializeExtension} = await import('resource:///org/gnome/Shell/Extensions/js/misc/extensionUtils.js');
const extension = extensionManager.createExtensionObject(serializeExtension({metadata, path, type: 2, state: 1}));
function walk(widget) {
    const children = [widget];
    for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
        children.push(...walk(child));
    return children;
}
const application = new Adw.Application({application_id: 'org.example.TuckPreferencesTest'});
application.connect('activate', () => {
    const window = new ExtensionPrefsDialog(extension);
    window.application = application;
    window.connect('loaded', () => {
        const preferences = extension.stateObj;
        const settings = preferences.getSettings();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            checkPreferences(Gtk, Gdk, settings, window, key => preferences._capture(window, settings, key, 'Test shortcut'), walk, () => {
                GLib.file_set_contents(GLib.getenv('TUCK_PREFERENCES_RESULT') || '/tmp/tuck/preferences-ready', 'passed');
                window.close();
            });
            return GLib.SOURCE_REMOVE;
        });
    });
    window.present();
});
await application.runAsync([]);
