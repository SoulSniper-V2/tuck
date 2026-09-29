// SPDX-License-Identifier: GPL-3.0-or-later
/* exported init, buildPrefsWidget */
const {Gdk, Gio, Gtk} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain('tuck').gettext;
const {parseAccelerator, shortcutDecision} = Me.imports.shortcuts;
const gtk4 = Gtk.get_major_version() === 4;

function init() {
    ExtensionUtils.initTranslations();
}

function append(box, child) {
    if (gtk4)
        box.append(child);
    else
        box.pack_start(child, false, false, 0);
}

function buildPrefsWidget() {
    const settings = ExtensionUtils.getSettings();
    const page = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 18,
        margin_top: 24, margin_bottom: 24, margin_start: 24, margin_end: 24});
    append(page, new Gtk.Label({label: _('Tuck — A little room to focus'), xalign: 0}));
    append(page, new Gtk.Label({label: _('Park a window for later. Restore it where it was, or bring it here.'),
        wrap: true, xalign: 0}));
    const row = new Gtk.Box({spacing: 12});
    append(row, new Gtk.Label({label: _('Window thumbnails'), hexpand: true, xalign: 0}));
    const previews = new Gtk.Switch({valign: Gtk.Align.CENTER});
    settings.bind('show-previews', previews, 'active', Gio.SettingsBindFlags.DEFAULT);
    append(row, previews);
    append(page, row);
    append(page, new Gtk.Label({label: _('Include Ctrl, Alt, or Super. Backspace clears; Escape cancels.'), wrap: true, xalign: 0}));
    const signals = [];
    for (const [key, title] of [['park-window', _('Park current window')], ['open-shelf', _('Open shelf')]]) {
        const line = new Gtk.Box({spacing: 12});
        append(line, new Gtk.Label({label: title, hexpand: true, xalign: 0}));
        const button = new Gtk.Button();
        const sync = () => {
            const accelerator = settings.get_strv(key)[0];
            const [, keyval, modifiers] = parseAccelerator(Gtk, accelerator || '');
            button.label = accelerator ? Gtk.accelerator_get_label(keyval, modifiers) : _('Disabled');
        };
        sync();
        signals.push(settings.connect(`changed::${key}`, sync));
        button.connect('clicked', () => capture(page, settings, key, title));
        append(line, button);
        append(page, line);
    }
    const reset = new Gtk.Button({label: _('Reset shortcuts')});
    reset.connect('clicked', () => {
        settings.reset('park-window');
        settings.reset('open-shelf');
    });
    append(page, reset);
    append(page, new Gtk.Label({label: _('Turning Tuck off reveals its parked windows. Normal minimize stays untouched.'),
        wrap: true, xalign: 0}));
    page.connect('unrealize', () => {
        for (const signal of signals.splice(0))
            settings.disconnect(signal);
    });
    if (!gtk4)
        page.show_all();
    return page;
}

function capture(page, settings, key, title) {
    const window = gtk4 ? page.get_root() : page.get_toplevel();
    const dialog = new Gtk.Dialog({title, transient_for: window, modal: true, destroy_with_parent: true});
    dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
    dialog.connect('response', () => dialog.destroy());
    const prompt = new Gtk.Label({label: _('Press a new shortcut'), margin_top: 24, margin_bottom: 24,
        margin_start: 24, margin_end: 24});
    append(dialog.get_content_area(), prompt);
    const accept = (keyval, state) => {
        const otherKey = key === 'park-window' ? 'open-shelf' : 'park-window';
        const decision = shortcutDecision(Gtk, Gdk, keyval, state, settings.get_strv(otherKey));
        if (decision.kind === 'invalid' || decision.kind === 'conflict') {
            prompt.label = decision.kind === 'invalid' ? _('Include Ctrl, Alt, or Super with the key.')
                : _('The other Tuck action already uses this shortcut.');
            return true;
        }
        if (decision.kind === 'save')
            settings.set_strv(key, [decision.accelerator]);
        else if (decision.kind === 'clear')
            settings.set_strv(key, []);
        dialog.destroy();
        return true;
    };
    if (gtk4) {
        const controller = new Gtk.EventControllerKey();
        controller.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        controller.connect('key-pressed', (_controller, keyval, _code, state) => accept(keyval, state));
        dialog.add_controller(controller);
    } else {
        dialog.connect('key-press-event', (_dialog, event) => accept(event.get_keyval()[1], event.get_state()[1]));
        dialog.show_all();
    }
    dialog.present();
    return dialog;
}
