// Classic GJS preferences fixture; getCurrentExtension matches the upstream host.
imports.gi.versions.Gtk = ARGV[1] || '3.0';
imports.gi.versions.Gdk = imports.gi.versions.Gtk;
// XSendEvent-based GTK tests require core events instead of XInput2. Fixture only.
if (imports.gi.versions.Gtk === '3.0')
    imports.gi.GLib.setenv('GDK_CORE_DEVICE_EVENTS', '1', true);
const {Gdk, Gio, GLib, Gtk} = imports.gi;
imports.searchPath.unshift('/tmp/tuck/tests/classic-host');
imports.searchPath.unshift('/tmp/tuck/tests');
const ExtensionUtils = imports.misc.extensionUtils;
const path = ARGV[0];
const [, contents] = Gio.File.new_for_path(`${path}/metadata.json`).load_contents(null);
const metadata = JSON.parse(imports.byteArray.toString(contents));
const extension = {metadata, uuid: metadata.uuid, path, dir: Gio.File.new_for_path(path)};
ExtensionUtils.getCurrentExtension = () => extension;
ExtensionUtils.installImporter(extension);
const preferences = extension.imports.prefs;
preferences.init();
const settings = ExtensionUtils.getSettings(metadata['settings-schema']);
const {checkPreferences} = imports.classicChecks;
function walk(widget) {
    const result = [widget];
    if (Gtk.get_major_version() === 4) {
        for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
            result.push(...walk(child));
    } else if (widget instanceof Gtk.Container) {
        for (const child of widget.get_children())
            result.push(...walk(child));
    }
    return result;
}
const application = new Gtk.Application({application_id: 'org.example.TuckPreferencesTest'});
application.connect('activate', () => {
    const window = new Gtk.ApplicationWindow({application, title: 'Tuck preferences'});
    const page = preferences.buildPrefsWidget();
    if (Gtk.get_major_version() === 4)
        window.set_child(page);
    else {
        window.add(page);
        window.show_all();
    }
    window.present();
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
        checkPreferences(Gtk, Gdk, settings, page, key => preferences.capture(page, settings, key, 'Test shortcut'), walk, () => {
            GLib.file_set_contents(GLib.getenv('TUCK_PREFERENCES_RESULT') || '/tmp/tuck/preferences-ready', 'passed');
            window.close();
        });
        return GLib.SOURCE_REMOVE;
    });
});
application.run([]);
