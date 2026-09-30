// SPDX-License-Identifier: GPL-3.0-or-later
// Keep version-dependent Shell APIs here; the shelf itself has one implementation.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

const [major, minor] = Config.PACKAGE_VERSION.split('.').map(Number);
const oldAllocation = major === 3 && minor < 38;

export function verticalBox(properties = {}) {
    const direction = major >= 48 ? {orientation: Clutter.Orientation.VERTICAL} : {vertical: true};
    return new St.BoxLayout({...properties, ...direction});
}

export function setScrollChild(scroll, child) {
    if (major >= 46)
        scroll.set_child(child);
    else
        scroll.add_actor(child);
}

export function verticalAdjustment(scroll) {
    return typeof scroll.get_vadjustment === 'function' ? scroll.get_vadjustment() : scroll.vscroll.adjustment;
}

export function searchKeys(entry, callback) {
    if (Clutter.KeyController) {
        const controller = new Clutter.KeyController();
        controller.connect('key-press', () => {
            const [, pressed, latched, locked] = controller.get_state();
            return callback(controller.get_key()[1], pressed | latched | locked);
        });
        entry.add_action_full('tuck-search-keys', Clutter.EventPhase.CAPTURE, controller);
        return () => entry.remove_action(controller);
    } else {
        const id = entry.connect('captured-event', (_actor, event) => {
            if (event.type() === Clutter.EventType.KEY_PRESS)
                return callback(event.get_key_symbol(), event.get_state());
            return Clutter.EVENT_PROPAGATE;
        });
        return () => entry.disconnect(id);
    }
}

export function menuKeys(menu, callback) {
    // Capture before the menu grab's Escape handler. Older Shell grabs at the
    // stage; newer Shell starts the event path at the grabbed menu actor.
    const actor = major < 42 ? global.stage : menu.actor;
    const disconnect = searchKeys(actor, (symbol, modifiers) => {
        const focus = global.stage.get_key_focus();
        if (!menu.isOpen || !focus || !menu.actor.contains(focus))
            return Clutter.EVENT_PROPAGATE;
        return callback(symbol, modifiers);
    });
    // The menu owns its controllers/signals and is destroyed before the panel
    // button. Only the stage outlives us and needs explicit disconnection.
    return actor === global.stage ? disconnect : () => {};
}

export function idleOnce(callback) {
    return GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        callback();
        return GLib.SOURCE_REMOVE;
    });
}

export function setAllocation(actor, box, flags) {
    if (oldAllocation)
        actor.set_allocation(box, flags);
    else
        actor.set_allocation(box);
}

export function allocate(actor, box, flags) {
    if (oldAllocation)
        actor.allocate(box, flags);
    else
        actor.allocate(box);
}
