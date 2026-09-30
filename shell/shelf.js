// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {matchesQuery} from '../model.js';
import {Thumbnail} from './thumbnail.js';
import {verticalBox, setScrollChild, verticalAdjustment, searchKeys, menuKeys, idleOnce} from './compat.js';
import {SignalGroup} from './signals.js';

function iconButton(iconName, name, callback) {
    const button = new St.Button({
        style_class: 'button flat tuck-icon-button',
        track_hover: true,
        accessible_name: name,
        can_focus: true,
        y_align: Clutter.ActorAlign.CENTER,
        child: new St.Icon({icon_name: iconName, icon_size: 16}),
    });
    button.connect('clicked', callback);
    return button;
}

function label(text, styleClass) {
    const actor = new St.Label({text, style_class: styleClass, y_align: Clutter.ActorAlign.CENTER});
    actor.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    return actor;
}

export const Shelf = GObject.registerClass(
class Shelf extends PanelMenu.Button {
    _init(store, settings, openPreferences) {
        super._init(0.5, _('Tuck'));
        this._store = store;
        this._settings = settings;
        this._focusedWindow = null;
        this._filteredWindows = [];
        this._rowControls = new Map();
        this._focusSource = 0;
        this._signals = new SignalGroup();
        this._tooltipSource = 0;
        this._tooltipTarget = null;
        this._tooltip = new St.Label({style_class: 'dash-label tuck-tooltip', visible: false});
        this._tooltip.clutter_text.line_wrap = true;
        this._tooltip.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        Main.uiGroup.add_child(this._tooltip);

        const panelBox = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        panelBox.add_child(new St.Icon({icon_name: 'view-restore-symbolic', style_class: 'system-status-icon'}));
        this._count = label('', 'tuck-panel-count');
        panelBox.add_child(this._count);
        this.add_child(panelBox);

        this._section = new PopupMenu.PopupMenuSection();
        this._section.actor.add_style_class_name('tuck-shelf');
        this.menu.addMenuItem(this._section);

        const header = new St.BoxLayout({style_class: 'tuck-header'});
        const heading = new St.BoxLayout({x_expand: true, style_class: 'tuck-title-box'});
        heading.add_child(label(_('Tuck'), 'tuck-heading'));
        this._subtitle = label('', 'tuck-count');
        heading.add_child(this._subtitle);
        header.add_child(heading);
        this._preferences = iconButton('emblem-system-symbolic', _('Preferences'), () => {
            this.menu.close();
            openPreferences();
        });
        this._hint(this._preferences, _('Preferences'));
        header.add_child(this._preferences);
        this._section.actor.add_child(header);

        this._search = new St.Entry({
            style_class: 'search-entry tuck-search',
            hint_text: _('Find a parked window…'),
            can_focus: true,
            x_expand: true,
            primary_icon: new St.Icon({icon_name: 'edit-find-symbolic', icon_size: 16}),
            accessible_name: _('Find a parked window'),
        });
        this._section.actor.add_child(this._search);
        this._search.clutter_text.connect('text-changed', () => {
            const query = this._search.get_text();
            if (query && !this._search.secondary_icon)
                this._search.set_secondary_icon(new St.Icon({icon_name: 'edit-clear-symbolic', icon_size: 16,
                    accessible_name: _('Clear Search')}));
            else if (!query)
                this._search.set_secondary_icon(null);
            this._render();
        });
        this._search.connect('secondary-icon-clicked', () => {
            this._search.set_text('');
            this._search.grab_key_focus();
        });
        this._menuKeysCleanup = menuKeys(this.menu, (symbol, modifiers) => {
            const focus = global.stage.get_key_focus();
            if ((symbol === Clutter.KEY_f || symbol === Clutter.KEY_F) && modifiers & Clutter.ModifierType.CONTROL_MASK) {
                this._search.grab_key_focus();
                return Clutter.EVENT_STOP;
            }
            if (symbol === Clutter.KEY_Escape && this._search.get_text()) {
                this._search.set_text('');
                this._search.grab_key_focus();
                return Clutter.EVENT_STOP;
            }
            if ((symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) && modifiers & Clutter.ModifierType.SHIFT_MASK) {
                const window = focus._tuckWindow || (this._search.contains(focus) ? this._filteredWindows[0] : null);
                if (window) {
                    this._restore(window, true);
                    return Clutter.EVENT_STOP;
                }
            }
            if (focus && focus._tuckWindow && (symbol === Clutter.KEY_Up || symbol === Clutter.KEY_Down)) {
                const index = this._filteredWindows.indexOf(focus._tuckWindow) + (symbol === Clutter.KEY_Down ? 1 : -1);
                if (index < 0)
                    this._search.grab_key_focus();
                else {
                    const controls = this._rowControls.get(this._filteredWindows[index]);
                    if (controls)
                        controls.restore.grab_key_focus();
                }
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        searchKeys(this._search, symbol => {
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                if (this._filteredWindows.length > 0)
                    this._restore(this._filteredWindows[0], false);
                return Clutter.EVENT_STOP;
            }
            if (symbol === Clutter.KEY_Down) {
                const controls = this._rowControls.get(this._filteredWindows[0]);
                if (controls)
                    controls.restore.grab_key_focus();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._scroll = new St.ScrollView({
            style_class: 'tuck-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
        });
        this._list = verticalBox({style_class: 'tuck-list'});
        setScrollChild(this._scroll, this._list);
        this._section.actor.add_child(this._scroll);

        this._empty = verticalBox({style_class: 'tuck-empty'});
        this._empty.add_child(new St.Icon({icon_name: 'view-restore-symbolic', icon_size: 48, style_class: 'tuck-empty-icon'}));
        this._emptyTitle = label(_('Keep it for later'), 'tuck-empty-title');
        this._emptyHint = label(_('Park a window. Pick it up when you need it.'), 'tuck-subtitle');
        this._emptyHint.clutter_text.line_wrap = true;
        this._emptyHint.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._empty.add_child(this._emptyTitle);
        this._empty.add_child(this._emptyHint);
        this._section.actor.add_child(this._empty);

        const footer = new St.BoxLayout({style_class: 'tuck-footer'});
        this._park = new St.Button({
            style_class: 'button tuck-park',
            label: _('Park Window'),
            can_focus: true,
            x_expand: true,
        });
        this._park.connect('clicked', () => this.parkFocused());
        footer.add_child(this._park);
        this._restoreAll = new St.Button({style_class: 'button tuck-restore-all', label: _('Restore All'), can_focus: true, x_expand: true});
        this._restoreAll.accessible_name = _('Restore all parked windows without switching workspaces');
        this._restoreAll.connect('clicked', () => {
            this.menu.close();
            try {
                this._store.restoreAll();
            } catch (error) {
                logError(error, 'Tuck');
                Main.notify(_('Tuck'), _('Some windows could not be restored. Try Overview or Alt-Tab.'));
            }
        });
        footer.add_child(this._restoreAll);
        this._section.actor.add_child(footer);
        this._keyHint = label(_('Enter to restore · Shift+Enter to bring here'), 'tuck-key-hint');
        this._section.actor.add_child(this._keyHint);

        this._signals.connect(global.display, 'notify::focus-window', () => {
            const window = global.display.focus_window;
            if (window || !this.menu.isOpen)
                this._setFocusedWindow(window);
        });
        this._signals.connect(global.stage, 'notify::key-focus', () => {
            this._revealFocusedRow();
            const focus = global.stage.get_key_focus();
            if (focus && focus._tuckHint)
                this._showHint(focus);
            else
                this._hideHint();
        });
        this._signals.connect(this._settings, 'changed::show-previews', () => this._render());
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                this._search.set_text('');
                this._render();
                // PopupMenu maps its actor and starts key navigation after this signal.
                this._focusSource = idleOnce(() => {
                    this._focusSource = 0;
                    if (this.menu.isOpen)
                        this._search.grab_key_focus();
                });
            } else {
                this._cancelFocus();
                this._hideHint();
                this._setFocusedWindow(global.display.focus_window);
                this._clearList();
            }
        });

        this._setFocusedWindow(global.display.focus_window);
        this.connect('destroy', () => {
            this._menuKeysCleanup();
            this._cancelFocus();
            this._hideHint();
            this._signals.clear();
            this._tooltip.destroy();
            this._setFocusedWindow(null);
            this._store = null;
            this._settings = null;
        });
        this.sync();
    }

    _hint(button, text) {
        button._tuckHint = text;
        button.connect('notify::hover', () => {
            if (button.hover)
                this._showHint(button);
            else if (this._tooltipTarget === button)
                this._hideHint();
        });
        button.connect('destroy', () => {
            if (this._tooltipTarget === button)
                this._hideHint();
        });
    }

    _showHint(button) {
        this._hideHint();
        if (!this.menu.isOpen)
            return;
        this._tooltipTarget = button;
        this._tooltipSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 450, () => {
            this._tooltipSource = 0;
            this._tooltip.set_size(-1, -1);
            this._tooltip.text = button._tuckHint;
            const monitor = Main.layoutManager.findMonitorForActor(button) || Main.layoutManager.primaryMonitor;
            const [x, y] = button.get_transformed_position();
            const [buttonWidth, buttonHeight] = button.get_transformed_size();
            const width = Math.min(this._tooltip.get_preferred_width(-1)[1], monitor.width - 24, 420);
            const height = this._tooltip.get_preferred_height(width)[1];
            this._tooltip.set_size(width, height);
            const left = Math.max(monitor.x + 12, Math.min(x + (buttonWidth - width) / 2, monitor.x + monitor.width - width - 12));
            const top = y + buttonHeight + height + 8 > monitor.y + monitor.height ? y - height - 8 : y + buttonHeight + 8;
            this._tooltip.set_position(left, Math.max(monitor.y + 8, top));
            this._tooltip.show();
            return GLib.SOURCE_REMOVE;
        });
    }

    _hideHint() {
        if (this._tooltipSource)
            GLib.Source.remove(this._tooltipSource);
        this._tooltipSource = 0;
        this._tooltipTarget = null;
        this._tooltip.hide();
    }

    _setFocusedWindow(window) {
        if (this._focusedWindow)
            this._signals.disconnect(this._focusedWindow);
        this._focusedWindow = window;
        if (window)
            this._signals.connect(window, 'unmanaged', () => this._setFocusedWindow(null));
    }

    _cancelFocus() {
        if (this._focusSource)
            GLib.Source.remove(this._focusSource);
        this._focusSource = 0;
    }

    _revealFocusedRow() {
        const focus = global.stage.get_key_focus();
        if (!this.menu.isOpen || !(focus && focus._tuckWindow))
            return;
        const box = focus.get_parent().get_allocation_box();
        if (box.get_height() === 0)
            return;
        const adjustment = verticalAdjustment(this._scroll);
        if (box.y1 < adjustment.value)
            adjustment.value = box.y1;
        else if (box.y2 > adjustment.value + adjustment.page_size)
            adjustment.value = box.y2 - adjustment.page_size;
    }

    sync() {
        const count = this._store.windows.length;
        this._count.text = count > 0 ? `${count}` : '';
        this._count.visible = count > 0;
        this.accessible_name = ngettext('Tuck, %d parked window', 'Tuck, %d parked windows', count).format(count);
        this._subtitle.text = ngettext('%d parked', '%d parked', count).format(count);
        this._subtitle.visible = count > 0;
        if (this.menu.isOpen)
            this._render();
    }

    toggle() {
        this.menu.toggle();
    }

    parkFocused() {
        const window = this.menu.isOpen ? this._focusedWindow : global.display.focus_window;
        this.menu.close();
        try {
            if (!this._store.park(window))
                Main.notify(_('Tuck'), _('Focus a regular application window to park it.'));
        } catch (error) {
            logError(error, 'Tuck');
            Main.notify(_('Tuck'), _('This window could not be parked.'));
        }
    }

    _restore(window, bringHere) {
        this.menu.close();
        try {
            this._store.restore(window, bringHere);
        } catch (error) {
            logError(error, 'Tuck');
            Main.notify(_('Tuck'), _('This window could not be restored. Try Overview or Alt-Tab.'));
        }
    }

    _clearList() {
        this._hideHint();
        this._list.destroy_all_children();
        this._filteredWindows = [];
        this._rowControls.clear();
    }

    _render() {
        const focus = global.stage.get_key_focus();
        const focusedWindow = focus && focus._tuckWindow;
        const focusedAction = focus && focus._tuckAction;
        this._clearList();
        if (!this.menu.isOpen)
            return;

        const tracker = Shell.WindowTracker.get_default();
        const query = this._search.get_text();
        for (const window of this._store.windows) {
            const app = tracker.get_window_app(window);
            const appName = app ? app.get_name() : _('Application');
            const title = window.get_title() || appName;
            if (matchesQuery(title, appName, query)) {
                this._filteredWindows.push(window);
                this._list.add_child(this._row(window, app, appName, title));
            }
        }

        const count = this._filteredWindows.length;
        const hasWindows = this._store.windows.length > 0;
        this._scroll.visible = count > 0;
        this._empty.visible = count === 0;
        this._emptyTitle.text = hasWindows ? _('No Matching Windows') : _('No Parked Windows');
        this._emptyHint.text = hasWindows ? _('Try another title or app name.') : _('Set a window aside and pick it up when you need it.');
        this._empty.get_first_child().icon_name = hasWindows ? 'edit-find-symbolic' : 'view-restore-symbolic';
        this._keyHint.visible = count > 0;
        this._restoreAll.reactive = hasWindows;
        this._restoreAll.can_focus = hasWindows;
        this._restoreAll.opacity = hasWindows ? 255 : 90;
        const canPark = this._store.canPark(this._focusedWindow);
        this._park.reactive = canPark;
        this._park.can_focus = canPark;
        this._park.opacity = canPark ? 255 : 110;

        const monitor = Main.layoutManager.findMonitorForActor(this) || Main.layoutManager.primaryMonitor;
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._section.actor.style = `width: 28em; min-width: 0; max-width: ${Math.max(240, monitor.width / scale - 80)}px;`;
        this._scroll.style = `max-height: ${Math.min(400, Math.max(120, monitor.height / scale - 240))}px;`;
        if (focusedWindow) {
            const controls = this._rowControls.get(focusedWindow);
            if (controls)
                controls[focusedAction].grab_key_focus();
            else
                this._search.grab_key_focus();
        }
    }

    _row(window, app, appName, title) {
        const row = new St.BoxLayout({style_class: 'tuck-row'});
        const restore = new St.Button({
            style_class: 'popup-menu-item tuck-restore', track_hover: true, can_focus: true, x_expand: true,
            accessible_name: _('Restore %s').format(title),
        });
        const content = new St.BoxLayout({style_class: 'tuck-row-content', x_expand: true});
        const makeIcon = () => app ? app.create_icon_texture(32) : new St.Icon({icon_name: 'application-x-executable-symbolic', icon_size: 32});
        if (this._settings.get_boolean('show-previews'))
            content.add_child(new Thumbnail(window, makeIcon()));
        else
            content.add_child(new St.Bin({style_class: 'tuck-app-icon', child: makeIcon()}));

        const text = verticalBox({style_class: 'tuck-row-text', x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        text.add_child(label(title, 'tuck-window-title'));
        const workspace = window.get_workspace();
        const location = window.is_on_all_workspaces()
            ? _('All workspaces')
            : workspace ? _('Workspace %d').format(workspace.index() + 1) : _('Workspace unavailable');
        text.add_child(label(_('%s · %s').format(appName, location), 'tuck-window-detail'));
        this._hint(restore, title);
        content.add_child(text);
        restore.child = content;
        restore._tuckWindow = window;
        restore._tuckAction = 'restore';
        restore.connect('clicked', () => this._restore(window, false));
        row.add_child(restore);
        const here = iconButton('go-jump-symbolic', _('Bring %s to this workspace').format(title), () => this._restore(window, true));
        this._hint(here, _('Bring Here'));
        here.y_align = Clutter.ActorAlign.CENTER;
        here.add_style_class_name('tuck-bring-here');
        here._tuckWindow = window;
        here._tuckAction = 'here';
        row.add_child(here);
        this._rowControls.set(window, {restore, here});
        return row;
    }
});
