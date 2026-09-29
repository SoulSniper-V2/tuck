// SPDX-License-Identifier: GPL-3.0-or-later
export function parseAccelerator(Gtk, accelerator) {
    const parsed = Gtk.accelerator_parse(accelerator);
    return parsed.length === 3 ? parsed : [parsed[0] !== 0, ...parsed];
}

export function shortcutDecision(Gtk, Gdk, keyval, state, existing) {
    const modifiers = state & Gtk.accelerator_get_default_mod_mask();
    if (keyval === Gdk.KEY_Escape)
        return {kind: 'cancel'};
    if (keyval === Gdk.KEY_BackSpace && modifiers === 0)
        return {kind: 'clear'};
    const keyLower = Gdk.keyval_to_lower(keyval);
    const altMask = Gtk.get_major_version() === 3 ? Gdk.ModifierType.MOD1_MASK : Gdk.ModifierType.ALT_MASK;
    const meaningful = modifiers & (Gdk.ModifierType.CONTROL_MASK | altMask | Gdk.ModifierType.SUPER_MASK);
    if (!Gtk.accelerator_valid(keyLower, modifiers) || !meaningful)
        return {kind: 'invalid'};
    const conflicts = existing.some(accelerator => {
        const [valid, otherKey, otherModifiers] = parseAccelerator(Gtk, accelerator);
        return valid && Gdk.keyval_to_lower(otherKey) === keyLower && otherModifiers === modifiers;
    });
    return conflicts ? {kind: 'conflict'} : {kind: 'save', accelerator: Gtk.accelerator_name(keyLower, modifiers)};
}
