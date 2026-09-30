# Verification record

29 September 2026. Tuck v0.3.0 was tested on sixteen GNOME Shell generations, from 3.32 through 51. This record separates native behavior checks from static checks and hosted CI.

## Local checks

`npm run check` passes ESLint, eleven behavioral unit tests, metadata and process-boundary checks, syntax checks for ten runtime modules, and checks of every generated classic module. Tests cover window eligibility and ownership, search, Unicode fallback on older JavaScript engines, thumbnail geometry, workspace preservation, sticky windows, external restoration, closure, failed minimize/move/restore, and cleanup when one window fails to restore.

Both packages build with Python 3.8 or later and strict GSettings schema compilation. Python 3.8.6 was also tested directly. npm dependencies are development-only; neither archive contains npm packages.

## Native compatibility matrix

Each row ran an actual GNOME Shell/Mutter compositor from official Fedora packages in a disposable filesystem. The matching release ZIP was extracted into the test user's extension directory. No GNOME packages were installed into the host OS. Each compositor ran as an unprivileged user in private mount/PID namespaces with software rendering at 1280×720. GNOME 3.x used a dedicated Xvfb display; GNOME 40 and later used headless Wayland.

| GNOME Shell | Fedora | Package | Native suite |
| --- | --- | --- | --- |
| 3.32.2 | 30 | Legacy | Passed, exit 0 |
| 3.34.5 | 31 | Legacy | Passed, exit 0 |
| 3.36.9 | 32 | Legacy | Passed, exit 0 |
| 3.38.5 | 33 | Legacy | Passed, exit 0 |
| 40.9 | 34 | Legacy | Passed, exit 0 |
| 41.9 | 35 | Legacy | Passed, exit 0 |
| 42.9 | 36 | Legacy | Passed, exit 0 |
| 43.9 | 37 | Legacy | Passed, exit 0 |
| 44.10 | 38 | Legacy | Passed, exit 0 |
| 45.10 | 39 | Modern | Passed, exit 0 |
| 46.10 | 40 | Modern | Passed, exit 0 |
| 47.10 | 41 | Modern | Passed, exit 0 |
| 48.8 | 42 | Modern | Passed, exit 0 |
| 49.10 | 43 | Modern | Passed, exit 0 |
| 50.5 | 44 | Modern | Passed, exit 0 |
| 51.0 | 45 | Modern | Passed, exit 0 |

[Machine-readable results](compatibility-results.json) record exact package versions, archive hashes, assertion coverage, counts, and exit status. Each generation passed the following flows:

- Load the packaged extension and open an empty shelf.
- Map nine real application windows; park and open the shelf with actual Mutter keyboard input.
- Allocate compositor thumbnails and readable title columns, browse windows with Up/Down, return to search with Ctrl+F, navigate through all nine entries, and scroll the last focused row into view.
- Type search text, clear with Escape or the clear icon, show no results, switch to icons, restore with Enter, show focus tooltips, and release thumbnail actors and tooltip timers when the popup closes.
- Restore externally, retain a window's workspace, move a window with actual Shift+Enter keyboard input, and restore all owned windows.
- Load native preferences with native shortcut keycaps, change the preview setting, reject conflicting and unmodified shortcuts, save Ctrl/Super and Alt-only shortcuts, cancel, clear, and reset.
- Disable and re-enable, reveal owned windows, preserve ordinary minimize, remove the indicator, and start with an empty store.

Preferences used GTK 3 on 3.32–3.38, GTK 4 on 40–44, and GTK 4/libadwaita on 45–51. GNOME 45's libadwaita 1.4 `MessageDialog` fallback was exercised, as were newer `AlertDialog` versions. Each preferences process must exit successfully and write a unique per-run result file; an old marker cannot make a run pass.

The GTK 3 shortcut checks send native GDK test key events. Their fixture opts into core device events so GDK receives those events under Xvfb. GTK 4 shortcut checks emit signals on the actual native key controller: they prove capture callbacks and settings behavior, but do not prove physical GTK keyboard delivery. Shelf keyboard tests separately use actual Mutter input on every generation.

## Additional GNOME 51 checks

The full suite also passed against GNOME Shell/Mutter 51.0, GJS 1.90.0, GTK 4.24.0, and libadwaita 1.10.0. [Native results](native-results.txt) record its assertions. It covers a Unicode long title and accessible name, a stable popup width with long titles, closure of a parked document, focus after a title notification, and light appearance at text scale 1.25.

[Shell](screenshots/documents.png), [scrolling](screenshots/many-windows.png), [Unicode search](screenshots/search-long-title.png), [light appearance](screenshots/light-large-text.png), and [preferences](screenshots/preferences.png) screenshots were refreshed from this run and inspected. Window content is test-fixture content. The README uses a direct area capture of the same live popup.

## Reproduce the compatibility suite

Use a disposable desktop/session: these fixtures create windows, change settings, and toggle the extension. They assume Fedora's resource paths, `/usr/bin/gjs`, `/tmp/tuck` as the source directory, and a fresh home/settings backend. Install the matching GNOME runtime, GLib tooling, and Python GObject bindings. Copy this checkout to `/tmp/tuck`, build, and extract the matching ZIP into `$XDG_DATA_HOME/gnome-shell/extensions/tuck@tuck-extension` (or `~/.local/share/gnome-shell/extensions/tuck@tuck-extension`).

Before starting the compositor in that disposable session:

```sh
cd /tmp/tuck
npm run pack
cp tests/wallpaper.png background.png
export GSETTINGS_BACKEND=keyfile
export SHELL_BACKGROUND_IMAGE=/tmp/tuck/background.png
export LIBGL_ALWAYS_SOFTWARE=1
export GJS_PATH=/tmp/tuck/tests
export WAYLAND_DISPLAY=tuck-test
# Execute these and Shell inside the same dbus-run-session.
gsettings set org.gnome.desktop.input-sources sources "[('xkb', 'us')]"
gsettings set org.gnome.shell enabled-extensions "['tuck@tuck-extension']"
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.desktop.interface enable-animations false
```

For GNOME 45–51:

```sh
gnome-shell --wayland --headless --virtual-monitor 1280x720 \
  --wayland-display tuck-test --no-x11 \
  --automation-script /tmp/tuck/tests/compatibility.js
```

For GNOME 40–44, substitute the installed Shell version in the preparation command:

```sh
python3 scripts/prepare-native.py --shell-version 42
SHELL_PERF_MODULE=compat gnome-shell --wayland --headless \
  --virtual-monitor 1280x720 --wayland-display tuck-test --no-x11
```

For GNOME 3.32–3.38, prepare the matching classic fixture, unset `WAYLAND_DISPLAY`, and run `SHELL_PERF_MODULE=compat gnome-shell --x11` on a separate Xvfb display. Start `/usr/libexec/gnome-shell-perf-helper` in the same D-Bus session first. The preparation script handles the older generator-based performance harness and extracts the installed preferences host's resources.

The matrix passed 1,028 assertions across sixteen sessions. An additional GNOME 49 fixture checked popup bounds at 640×480 with text scale 1.5 (x=44, y=48, width=590, height=393) and retained all nine rows after changing the shelf to RTL. This was a layout check, not a translated-language or screen-reader test.

Fast headless GNOME 50–51 sessions sometimes finished startup before Shell connected its automation handler. The test fixtures now invoke the standard performance runner when startup has already finished. No Shell source or Tuck runtime is patched for this workaround. The isolated matrix lacked login/GDM, PolicyKit, and other full-session services, which produced warnings. Trusted fixture image loading used a disabled Glycin sandbox where the disposable environment could not provide one. That override is absent from Tuck and is not an installation requirement. A normal desktop should retain its normal image sandbox.

## Package integrity and limits

The archives contain only ten JavaScript modules, metadata, stylesheet, source and compiled settings schema, and license. ZIP integrity, the explicit allowlist, and packaged source bytes were checked. The same project UUID, `tuck@tuck-extension`, is used by both packages.

| Release archive | Native-tested SHA-256 |
| --- | --- |
| `tuck-v0.3.0.shell-extension.zip` | `e3b21fdc230a8e6c238860692195abca0451eb9719591aa507f07389801bc6ab` |
| `tuck-v0.3.0-legacy.shell-extension.zip` | `31b371f7bfb3c11c573092ca3d6777b062088b34916d3d5e17df2031eeab7e4b` |

GNOME 3.30 and earlier use an older panel contract that this implementation does not support. Physical GPU/multi-monitor configurations, screen readers, touch input, translated keyboard layouts, extended real-application usage, and combinations with other extensions remain untested. Passing these fixtures is not a complete accessibility certification or a guarantee for every distribution patch.

[GitHub Actions](https://github.com/SoulSniper-V2/tuck/actions) checks lint, unit behavior, schemas, and both packages. Hosted checks are separate from the native results above. Submission to extensions.gnome.org and catalog review remain unperformed.
