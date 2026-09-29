#!/usr/bin/env python3
"""Create extension archives with an explicit runtime-only allowlist."""
import pathlib
import shutil
import subprocess
import tempfile
import zipfile
from build import ROOT as root, RUNTIME, stage_files

compiler = shutil.which('glib-compile-schemas')
if not compiler:
    raise SystemExit('glib-compile-schemas is required. Build on GNOME/Linux, or install GLib development tools locally.')
destination = root / 'dist'
destination.mkdir(exist_ok=True)
for legacy in (False, True):
    with tempfile.TemporaryDirectory() as temporary:
        stage = pathlib.Path(temporary)
        metadata = stage_files(stage, legacy)
        files = RUNTIME + ['metadata.json', 'stylesheet.css', 'LICENSE', 'schemas/org.gnome.shell.extensions.tuck.gschema.xml']
        files += [str(path.relative_to(root)) for path in sorted((root / 'locale').glob('*/LC_MESSAGES/*.mo'))]
        for name in files:
            if (stage / name).exists():
                continue
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / name, target)
        subprocess.run([compiler, '--strict', str(stage / 'schemas')], check=True)
        files.append('schemas/gschemas.compiled')
        suffix = '-legacy' if legacy else ''
        archive = destination / f'tuck-v{metadata["version-name"]}{suffix}.shell-extension.zip'
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
