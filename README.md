# Tuck

A little room to focus. Park a window for later, then find it in a small shelf in the top panel.

Tuck collects only windows you explicitly park. Each entry shows a thumbnail, title, application, and workspace. Click the entry to restore it on its existing workspace, or choose **Bring here** to move it to your current one.

![Tuck running in GNOME Shell 51](docs/screenshots/shelf.png)

## Use

| Action | Default shortcut |
| --- | --- |
| Park the focused window | Super + Ctrl + H |
| Open the shelf | Super + Ctrl + Space |
| Restore the first search result | Enter |
| Move from search into the results | Down |
| Navigate controls | Tab / Shift + Tab |
| Dismiss the shelf | Escape |

The panel menu also has **Park current window**, **Restore all**, and a preferences button. Preferences let you change or clear both shortcuts and turn thumbnails off.

Normal minimizing, Overview, and Alt-Tab keep working. Restoring a parked window elsewhere removes it from Tuck. Closing an application removes its entry. Turning the extension off reveals its remaining parked windows without changing their workspaces or focusing them. No windows, titles, or screenshots are saved to disk.

Thumbnails use compositor clones while the popup is open. Minimized applications may pause drawing. Tuck does not promise continuously updating video previews.

## Install

Download the matching ZIP from the [v0.2.0 prerelease](https://github.com/SoulSniper-V2/tuck/releases/tag/v0.2.0).

| GNOME Shell | Package |
| --- | --- |
| 45, 46, 47, 48, 49, 50, 51 | `tuck-v0.2.0.shell-extension.zip` |
| 3.32, 3.34, 3.36, 3.38, 40, 41, 42, 43, 44 | `tuck-v0.2.0-legacy.shell-extension.zip` |

Both packages use **tuck@tuck-extension** and preserve the same settings. The modern package uses ECMAScript modules; the legacy package uses GNOME's older loader. Use the matching package when upgrading across GNOME 44 → 45. GNOME 3.30 and earlier are unsupported.

Check your version with `gnome-shell --version`. On GNOME 3.34 or later:

```sh
# Substitute the legacy ZIP on GNOME 3.34–44.
gnome-extensions install --force tuck-v0.2.0.shell-extension.zip
```

Log out and back in so Shell discovers the installed extension, then:

```sh
gnome-extensions enable tuck@tuck-extension
gnome-extensions prefs tuck@tuck-extension
```

GNOME 3.32 predates that CLI. Extract the legacy ZIP into `~/.local/share/gnome-shell/extensions/tuck@tuck-extension`, log out and back in, then enable Tuck through GNOME Tweaks or `gnome-shell-extension-tool --enable tuck@tuck-extension`. Open its preferences through GNOME's extension preferences tool or Tuck's gear button.

If you installed the first early build with a different extension ID, disable and uninstall that copy first. Updates from the renamed v0.1.0 package keep the current ID.

You can also enable Tuck through GNOME Extensions or Extension Manager on supported versions. If a default shortcut is already in use, change it in preferences. Tuck detects collisions between its own actions; it cannot comprehensively detect other extensions' shortcuts.

## Build and check

Runtime: GJS and GNOME Shell. Preferences use GTK 3 on GNOME 3.32–3.38, GTK 4 on GNOME 40–44, and GTK 4/libadwaita on GNOME 45–51. There are no runtime npm packages, companion services, network requests, prototype patches, or background polling.

Developer tooling: Node 24 or later, Python 3.8 or later, and `glib-compile-schemas` for packaging.

```sh
npm ci
npm run check
npm run pack
```

Both packages are written to `dist/`. Their explicit file lists exclude tests, documentation, npm dependencies, and development configuration.

For the native compatibility matrix and reproducible isolated-session tests, see [verification](docs/verification.md). Unit checks alone do not prove Shell integration. Hosted lint, unit, schema, and package checks are available in [GitHub Actions](https://github.com/SoulSniper-V2/tuck/actions). Native GNOME tests are recorded separately.

## Limitations

- Parking is session-only. It does not survive logout or Shell restart.
- Only normal, minimizable application windows are eligible; dialogs and transient windows are excluded.
- Restore uses the window's current workspace, including changes made after parking.
- Physical multi-monitor/GPU configurations, screen readers, touch input, extended application usage, and extension combinations require additional testing.
- This prerelease has not been submitted to extensions.gnome.org.

GPL-3.0-or-later. See [LICENSE](LICENSE).
