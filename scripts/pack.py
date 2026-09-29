#!/usr/bin/env python3
"""Create an extension archive with an explicit runtime-only allowlist."""
import json
import pathlib
import shutil
import subprocess
import tempfile
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
metadata = json.loads((root / 'metadata.json').read_text())
files = ['extension.js', 'prefs.js', 'model.js', 'windowStore.js', 'metadata.json', 'stylesheet.css', 'LICENSE']
files += ['shell/shelf.js', 'shell/thumbnail.js', 'schemas/org.gnome.shell.extensions.tuck.gschema.xml']
files += [str(path.relative_to(root)) for path in sorted((root / 'locale').glob('*/LC_MESSAGES/*.mo'))]

compiler = shutil.which('glib-compile-schemas')
if not compiler:
    raise SystemExit('glib-compile-schemas is required. Build on GNOME/Linux, or install GLib development tools locally.')

destination = root / 'dist'
destination.mkdir(exist_ok=True)
archive = destination / f'tuck-v{metadata["version-name"]}.shell-extension.zip'
with tempfile.TemporaryDirectory() as temporary:
    stage = pathlib.Path(temporary)
    for name in files:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / name, target)
    subprocess.run([compiler, '--strict', str(stage / 'schemas')], check=True)
    files.append('schemas/gschemas.compiled')
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as output:
        for name in files:
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            output.writestr(info, (stage / name).read_bytes())

with zipfile.ZipFile(archive) as packaged:
    assert packaged.testzip() is None
    assert set(packaged.namelist()) == set(files)
print(archive)
