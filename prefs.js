// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {shortcutDecision} from './shortcuts.js';

const ShortcutLabel = 'ShortcutLabel' in Adw ? Adw.ShortcutLabel : Gtk.ShortcutLabel;

export default class TuckPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(540, 480);
        const page = new Adw.PreferencesPage({title: _('Tuck'), icon_name: 'view-restore-symbolic'});
        window.add(page);

        const appearance = new Adw.PreferencesGroup({title: _('Shelf')});
        const previews = new Adw.SwitchRow({
            title: _('Window Previews'),
            subtitle: _('Show window previews instead of app icons.'),
        });
        settings.bind('show-previews', previews, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearance.add(previews);
        page.add(appearance);

        const shortcuts = new Adw.PreferencesGroup({
            title: _('Keyboard Shortcuts'),
            description: _('Select a shortcut to change it.'),
        });
        this._shortcutRow(shortcuts, window, settings, 'park-window', _('Park Window'));
        this._shortcutRow(shortcuts, window, settings, 'open-shelf', _('Open Shelf'));
        const resetButton = new Gtk.Button({label: _('Reset'), valign: Gtk.Align.CENTER,
            tooltip_text: _('Restore Default Shortcuts')});
        resetButton.add_css_class('flat');
        resetButton.connect('clicked', () => {
            settings.reset('park-window');
            settings.reset('open-shelf');
        });
        shortcuts.header_suffix = resetButton;
        const syncReset = () => {
            resetButton.sensitive = ['park-window', 'open-shelf'].some(key =>
                JSON.stringify(settings.get_strv(key)) !== JSON.stringify(settings.get_default_value(key).deep_unpack()));
        };
        syncReset();
        const resetSignal = settings.connect('changed', syncReset);
        window.connect('close-request', () => {
            settings.disconnect(resetSignal);
            return false;
        });
        page.add(shortcuts);

        page.add(new Adw.PreferencesGroup({
            description: _('Parked windows return when Tuck is turned off. Parking lasts for this session only.'),
        }));
    }

    _shortcutRow(group, window, settings, key, title) {
        const row = new Adw.ActionRow({title});
        const shortcut = new ShortcutLabel({disabled_text: _('Disabled')});
        const button = new Gtk.Button({valign: Gtk.Align.CENTER, child: shortcut,
            tooltip_text: _('Change Shortcut')});
        button.add_css_class('flat');
        const sync = () => shortcut.set_accelerator(settings.get_strv(key)[0] || '');
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
        const dialog = Adw.AlertDialog
            ? new Adw.AlertDialog({heading: title, body: _('Press a shortcut with Ctrl, Alt, or Super.\nBackspace disables it; Escape cancels.')})
            : new Adw.MessageDialog({transient_for: window, modal: true, heading: title, body: _('Press a shortcut with Ctrl, Alt, or Super.\nBackspace disables it; Escape cancels.')});
        dialog.add_response('cancel', _('Cancel'));
        dialog.close_response = 'cancel';
        const controller = new Gtk.EventControllerKey();
        controller.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        controller.connect('key-pressed', (_controller, keyval, _keycode, state) => {
            const otherKey = key === 'park-window' ? 'open-shelf' : 'park-window';
            const decision = shortcutDecision(Gtk, Gdk, keyval, state, settings.get_strv(otherKey));
            if (decision.kind === 'invalid' || decision.kind === 'conflict') {
                dialog.body = decision.kind === 'invalid'
                    ? _('Include Ctrl, Alt, or Super with the key.')
                    : _('The other Tuck action already uses this shortcut.');
                return true;
            }
            if (decision.kind === 'save')
                settings.set_strv(key, [decision.accelerator]);
            else if (decision.kind === 'clear')
                settings.set_strv(key, []);
            dialog.close();
            return true;
        });
        dialog.add_controller(controller);
        if (Adw.AlertDialog)
            dialog.present(window);
        else
            dialog.present();
        return dialog;
    }
}
