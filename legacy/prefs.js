// SPDX-License-Identifier: GPL-3.0-or-later
/* exported init, buildPrefsWidget */
const {Gdk, Gio, Gtk} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain('tuck').gettext;
const {shortcutDecision} = Me.imports.shortcuts;
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
    const page = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 24,
        margin_top: 24, margin_bottom: 24, margin_start: 24, margin_end: 24});
    const makeGroup = title => {
        const group = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12});
        const heading = new Gtk.Label({label: title, xalign: 0});
        heading.get_style_context().add_class('heading');
        append(group, heading);
        const list = new Gtk.ListBox({selection_mode: Gtk.SelectionMode.NONE});
        list.get_style_context().add_class('boxed-list');
        const frame = new Gtk.Frame({child: list});
        append(group, frame);
        append(page, group);
        return list;
    };
    const addRow = (list, title, control) => {
        const content = new Gtk.Box({spacing: 18, margin_top: 12, margin_bottom: 12, margin_start: 12, margin_end: 12});
        append(content, new Gtk.Label({label: title, hexpand: true, xalign: 0}));
        append(content, control);
        const row = new Gtk.ListBoxRow({child: content, activatable: true});
        if (gtk4)
            list.append(row);
        else
            list.add(row);
        return row;
    };
    const appearance = makeGroup(_('Shelf'));
    const previews = new Gtk.Switch({valign: Gtk.Align.CENTER});
    settings.bind('show-previews', previews, 'active', Gio.SettingsBindFlags.DEFAULT);
    const previewRow = addRow(appearance, _('Window Previews'), previews);
    appearance.connect('row-activated', (_list, row) => {
        if (row === previewRow)
            previews.active = !previews.active;
    });
    const shortcuts = makeGroup(_('Keyboard Shortcuts'));
    const signals = [];
    for (const [key, title] of [['park-window', _('Park Window')], ['open-shelf', _('Open Shelf')]]) {
        const shortcut = new Gtk.ShortcutLabel({disabled_text: _('Disabled')});
        const button = new Gtk.Button({valign: Gtk.Align.CENTER, tooltip_text: _('Change Shortcut')});
        if (gtk4)
            button.set_child(shortcut);
        else
            button.add(shortcut);
        button.get_style_context().add_class('flat');
        const sync = () => shortcut.set_accelerator(settings.get_strv(key)[0] || '');
        sync();
        signals.push(settings.connect(`changed::${key}`, sync));
        const row = addRow(shortcuts, title, button);
        button.connect('clicked', () => capture(page, settings, key, title));
        shortcuts.connect('row-activated', (_list, activated) => {
            if (activated === row)
                capture(page, settings, key, title);
        });
    }
    const reset = new Gtk.Button({label: _('Reset shortcuts')});
    reset.connect('clicked', () => {
        settings.reset('park-window');
        settings.reset('open-shelf');
    });
    append(page, reset);
    append(page, new Gtk.Label({label: _('Parked windows return when Tuck is turned off. Parking lasts for this session only.'),
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
    const prompt = new Gtk.Label({label: _('Press a shortcut with Ctrl, Alt, or Super.\nBackspace disables it; Escape cancels.'), wrap: true, margin_top: 24, margin_bottom: 24,
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
