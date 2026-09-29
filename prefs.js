// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class TuckPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(560, 570);
        const page = new Adw.PreferencesPage({title: _('Tuck'), icon_name: 'view-restore-symbolic'});
        window.add(page);

        const introduction = new Adw.PreferencesGroup({
            title: _('A little room to focus'),
            description: _('Park a window for later. Restore it where it was, or bring it to the workspace you are using now.'),
        });
        page.add(introduction);

        const appearance = new Adw.PreferencesGroup({title: _('Shelf')});
        const previews = new Adw.SwitchRow({
            title: _('Window thumbnails'),
            subtitle: _('Shown only while the shelf is open. Minimized apps may pause drawing.'),
        });
        settings.bind('show-previews', previews, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearance.add(previews);
        page.add(appearance);

        const shortcuts = new Adw.PreferencesGroup({
            title: _('Keyboard shortcuts'),
            description: _('Choose shortcuts that are not used by another extension. Backspace clears a shortcut; Escape cancels.'),
        });
        this._shortcutRow(shortcuts, window, settings, 'park-window', _('Park current window'));
        this._shortcutRow(shortcuts, window, settings, 'open-shelf', _('Open shelf'));
        const reset = new Adw.ActionRow({title: _('Reset shortcuts')});
        const resetButton = new Gtk.Button({label: _('Reset'), valign: Gtk.Align.CENTER});
        resetButton.connect('clicked', () => {
            settings.reset('park-window');
            settings.reset('open-shelf');
        });
        reset.add_suffix(resetButton);
        shortcuts.add(reset);
        page.add(shortcuts);

        const behavior = new Adw.PreferencesGroup({title: _('Your windows stay yours')});
        behavior.add(new Adw.ActionRow({
            title: _('Only explicitly parked windows are collected'),
            subtitle: _('Normal minimize, Overview, and Alt-Tab keep working. Turning Tuck off reveals its parked windows without moving them.'),
        }));
        page.add(behavior);
    }

    _shortcutRow(group, window, settings, key, title) {
        const row = new Adw.ActionRow({title});
        const button = new Gtk.Button({valign: Gtk.Align.CENTER});
        const sync = () => {
            const accelerator = settings.get_strv(key)[0];
            if (accelerator) {
                const [, keyval, modifiers] = Gtk.accelerator_parse(accelerator);
                button.set_label(Gtk.accelerator_get_label(keyval, modifiers));
            } else {
                button.set_label(_('Disabled'));
            }
        };
        sync();
        const signal = settings.connect(`changed::${key}`, sync);
        // Preferences rows can be destroyed by their parent without a JS destroy call.
        window.connect('close-request', () => {
            settings.disconnect(signal);
            return false;
        });
        button.connect('clicked', () => this._capture(window, settings, key, title));
        row.add_suffix(button);
        row.activatable_widget = button;
        group.add(row);
    }

    _capture(window, settings, key, title) {
        const dialog = new Adw.AlertDialog({heading: title, body: _('Press a new shortcut')});
        dialog.add_response('cancel', _('Cancel'));
        dialog.close_response = 'cancel';
        const controller = new Gtk.EventControllerKey();
        controller.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        controller.connect('key-pressed', (_controller, keyval, _keycode, state) => {
            const modifiers = state & Gtk.accelerator_get_default_mod_mask();
            if (keyval === Gdk.KEY_Escape) {
                dialog.close();
                return true;
            }
            if (keyval === Gdk.KEY_BackSpace && modifiers === 0) {
                settings.set_strv(key, []);
                dialog.close();
                return true;
            }
            const keyLower = Gdk.keyval_to_lower(keyval);
            const meaningful = modifiers & (Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.ALT_MASK | Gdk.ModifierType.SUPER_MASK);
            if (!Gtk.accelerator_valid(keyLower, modifiers) || !meaningful) {
                dialog.body = _('Include Ctrl, Alt, or Super with the key.');
                return true;
            }
            const accelerator = Gtk.accelerator_name(keyLower, modifiers);
            const otherKey = key === 'park-window' ? 'open-shelf' : 'park-window';
            if (settings.get_strv(otherKey).includes(accelerator)) {
                dialog.body = _('The other Tuck action already uses this shortcut.');
                return true;
            }
            settings.set_strv(key, [accelerator]);
            dialog.close();
            return true;
        });
        dialog.add_controller(controller);
        dialog.present(window);
    }
}

