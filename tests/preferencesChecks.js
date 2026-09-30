// Shared native GTK assertions. Callback steps also work with the older GJS main loop.
import GLib from 'gi://GLib';

export function checkPreferences(Gtk, Gdk, settings, page, capture, walk, complete) {
    const assert = (condition, message) => {
        if (!condition)
            throw new Error(message);
        print(`TUCK PREFS COMPAT PASS: ${message}`);
    };
    const later = (milliseconds, callback) => GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
        callback();
        return GLib.SOURCE_REMOVE;
    });
    const widgets = walk(page);
    const previews = widgets.find(widget => widget instanceof Gtk.Switch || widget.constructor.name.includes('SwitchRow'));
    assert(!!previews, 'native preview control exists');
    previews.active = false;
    assert(!settings.get_boolean('show-previews'), 'preview switch disables thumbnails');
    previews.active = true;
    assert(settings.get_boolean('show-previews'), 'preview switch enables thumbnails');
    assert(widgets.filter(widget => widget.constructor.name.includes('ShortcutLabel')).length === 2, 'shortcuts use native keycap labels');
    const modifiers = Gdk.ModifierType.SUPER_MASK | Gdk.ModifierType.CONTROL_MASK;
    const steps = [
        ['open-shelf', Gdk.KEY_h, modifiers, '<Super><Control>space', 'default collision rejected', true],
        ['park-window', Gdk.KEY_p, modifiers, '<Control><Super>p', 'normalized shortcut saved', false],
        ['open-shelf', Gdk.KEY_p, modifiers, '<Super><Control>space', 'duplicate shortcut rejected', true],
        ['park-window', Gdk.KEY_a, 0, '<Control><Super>p', 'unmodified typing rejected', true],
        ['park-window', Gdk.KEY_Escape, 0, '<Control><Super>p', 'Escape preserves shortcut', false],
        ['park-window', Gdk.KEY_x, Gtk.get_major_version() === 3 ? Gdk.ModifierType.MOD1_MASK : Gdk.ModifierType.ALT_MASK, '<Alt>x', 'Alt-only shortcut saved', false],
        ['park-window', Gdk.KEY_BackSpace, 0, undefined, 'Backspace clears shortcut', false],
    ];
    const next = () => {
        if (!steps.length) {
            const reset = widgets.find(widget => widget instanceof Gtk.Button && widget.label && widget.label.startsWith('Reset'));
            reset.emit('clicked');
            assert(settings.get_strv('park-window')[0] === '<Super><Control>h', 'reset restores defaults');
            complete();
            return;
        }
        const [key, keyval, state, expected, message, closeAfter] = steps.shift();
        const dialog = capture(key);

        later(100, () => {
            const verify = () => {
                const actual = settings.get_strv(key)[0];

                const parse = accelerator => Gtk.accelerator_parse(accelerator).slice(-2).join(':');
                assert(expected === undefined ? actual === undefined : !!actual && parse(actual) === parse(expected), message);
                if (closeAfter) {
                    if (Gtk.get_major_version() === 3)
                        dialog.destroy();
                    else
                        dialog.close();
                }
                later(100, next);
            };
            if (Gtk.get_major_version() === 4) {
                const controllers = dialog.observe_controllers();
                const controller = Array.from({length: controllers.get_n_items()}, (_, i) => controllers.get_item(i))
                    .find(item => item instanceof Gtk.EventControllerKey);
                assert(!!controller, 'capture uses native key controller');
                controller.emit('key-pressed', keyval, 0, state);
                verify();
            } else {
                const xstate = state & ~Gdk.ModifierType.SUPER_MASK |
                    (state & Gdk.ModifierType.SUPER_MASK ? Gdk.ModifierType.MOD4_MASK : 0);
                const keyWindow = dialog.get_window();
                Gdk.test_simulate_key(keyWindow, 10, 10, keyval, xstate, Gdk.EventType.KEY_PRESS);
                Gdk.test_simulate_key(keyWindow, 10, 10, keyval, xstate, Gdk.EventType.KEY_RELEASE);
                later(100, verify);
            }
        });
    };
    next();
}
