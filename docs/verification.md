# Verification record

29 September 2026. This records checks performed, rather than treating the supplied CI configuration as a successful hosted run.

## Local checks — PROVEN

`npm run check` passed: ESLint, nine behavioral unit tests, metadata and process-boundary checks, and Node syntax checks for six runtime modules. The unit tests cover eligibility, ownership, duplicate parking, Unicode matching, thumbnail geometry, workspace preservation, sticky windows, external restoration, closure, failed minimize/move/restore, and cleanup after one restoration fails.

Dependencies are development-only. Installation audited 78 packages with no reported vulnerabilities at that time; this is a point-in-time npm result, not a security guarantee.

## Native runtime — PROVEN within this environment

The packaged ZIP was installed with the upstream `gnome-shell-test-tool`, which invokes `gnome-extensions install`. An actual GNOME Shell compositor ran a virtual 1280×720 Wayland display with software rendering. It was not a UI mock or Node emulation.

The test environment was an isolated Fedora 45 filesystem on the connected Linux host. Its package versions were:

| Component | Version |
| --- | --- |
| GNOME Shell | 51.0-1.fc45 |
| Mutter | 51.0-1.fc45 |
| GJS | 1.90.0-1.fc45 |
| GTK | 4.24.0-1.fc45 |
| libadwaita | 1.10.0-2.fc45 |
| GLib | 2.89.4-1.fc45 |

The official Fedora OCI layer was SHA-256 `71546fe274272d445223ed6fed4ddc9f1664c49a31485957bf625b2d88ecc31b`. No GNOME packages were installed into the host OS. The compositor ran as an unprivileged user inside a private mount/PID namespace.

[Native results](native-results.txt) record the passing assertions. The suite exercised:

- Actual Mutter keyboard input for park, open shelf, Escape, Down, Enter, and typed search.
- Real Meta.Window minimize/unminimize and workspace changes, existing-workspace restoration, and Bring here.
- Empty and no-result views, icon mode, compositor thumbnails, and immediate clone destruction when the popup closes.
- Focus clearing on an empty workspace and keyboard focus preservation after a title-property notification on a real window.
- Nine real GTK document windows, Tab navigation through all nine rows with automatic scrolling, an actual Unicode long title, its complete accessible name, and closure of a parked window.
- Native GTK/libadwaita preferences loaded through GNOME's ExtensionPrefsDialog. Switch binding and shortcut-capture callbacks were exercised through native controller signals: normalized keys, equivalent modifier ordering, duplicate rejection, invalid unmodified typing, Escape, Backspace, and reset.
- Light Shell appearance with text scaling set to 1.25; dark appearance at the default scale.
- Disable/re-enable, panel removal, revealing owned windows, and leaving ordinarily minimized windows alone.

[Shell](screenshots/shelf.png), [scrolling](screenshots/many-windows.png), [Unicode search](screenshots/search-long-title.png), [light appearance](screenshots/light-large-text.png), and [preferences](screenshots/preferences.png) screenshots were inspected. Test-window content is explicitly fixture content, not customer or adoption proof.

The environment lacked login/GDM, PolicyKit, and other full-session services, which produced system warnings. Early PRoot attempts stalled timers; the final checks used a real chroot in private namespaces. Some isolated starts stalled before Shell emitted startup-complete, including a run with a PNG background. The successful run used a trusted two-pixel PNG fixture, but that does not prove the cause of the intermittent startup stalls. The successful final run exited normally and contained no Tuck JavaScript errors. This does not establish the cause of every environment warning.

Glycin's image sandbox was disabled only for the isolated trusted-fixture run because that environment could not provide its usual sandbox. This setting is absent from the extension and is not an installation requirement.

## Reproduce the native fixture

The fixture currently assumes Fedora's GNOME 51 resource paths and `/tmp/tuck` as its working source directory. Use a separate disposable desktop/session, not an everyday session: it creates test windows, changes appearance settings, and toggles the extension. Install the normal GNOME 51 runtime plus Python GObject bindings. Copy this checkout to `/tmp/tuck`, build the package there, and run:

```sh
cd /tmp/tuck
npm run pack
cp tests/wallpaper.png background.png
rm -f preferences-ready
TUCK_SCREENSHOT_DIR=/tmp/tuck/screenshots \
SHELL_BACKGROUND_IMAGE=/tmp/tuck/background.png \
dbus-run-session -- gnome-shell-test-tool \
  --headless --disable-animations \
  --extra-filter org.example.TuckPreferencesTest \
  --extra-filter org.example.TuckWindowTest \
  --extension dist/tuck-v0.1.0.shell-extension.zip \
  /tmp/tuck/tests/native.js
```

A normal fully provisioned GNOME environment should retain its normal image sandbox. The private-filesystem setup used here is not required to install Tuck.

## Native-tested package — PROVEN

Strict GSettings compilation succeeded. The ZIP's integrity and explicit allowlist were checked, and every packaged source file was compared with the delivered source. Runtime files only: six JavaScript modules, stylesheet, metadata, source and compiled settings schema, and license.

The archive tested above predates the public metadata URL, project-only extension ID, and friendly archive name. Its behavior implementation is unchanged. The updated identity and packaging are checked in GitHub Actions; the native suite was recorded with the earlier identity. The prerelease ZIP has its own attached checksum.

Native-tested ZIP SHA-256:

```text
b882c950d9bf1ec7e2c7601509c9ee0605cb2fca77aac3c3331b9d8f79e520b0
```

## Limits and external state

GNOME versions other than 51, physical displays/GPU configurations, screen readers, touch input, translated layouts, extended real-application usage, and combinations with other extensions remain untested. Accessible names and keyboard behavior were checked; that is not a complete accessibility certification.

The public [repository](https://github.com/SoulSniper-V2/tuck) includes an issue tracker and a pinned [GitHub Actions workflow](https://github.com/SoulSniper-V2/tuck/actions) for lint, unit, schema, and packaging checks. Hosted results do not replace the native runtime evidence above. The early release targets GNOME 51 only. Submission to extensions.gnome.org and catalog review remain separate, unperformed actions.
