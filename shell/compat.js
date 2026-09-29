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
        controller.connect('key-press', () => callback(controller.get_key()[1]));
        entry.add_action_full('tuck-search-keys', Clutter.EventPhase.CAPTURE, controller);
    } else {
        entry.connect('captured-event', (_actor, event) => {
            if (event.type() === Clutter.EventType.KEY_PRESS)
                return callback(event.get_key_symbol());
            return Clutter.EVENT_PROPAGATE;
        });
    }
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
