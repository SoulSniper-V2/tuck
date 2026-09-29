#!/usr/bin/env python3
"""Static distribution checks. Native runtime tests are a separate command."""
import json
import pathlib
import re
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
metadata = json.loads((root / 'metadata.json').read_text())
assert re.fullmatch(r'[\w.-]+@[\w.-]+', metadata['uuid'], re.ASCII)
assert metadata['shell-version'] == ['51'], 'Only runtime-assessed versions belong in metadata'
assert 'version' not in metadata, 'The catalog owns its numeric version'
assert metadata['settings-schema'] == 'org.gnome.shell.extensions.tuck'
assert 'session-modes' not in metadata, 'Use the default user session only'

runtime = [root / name for name in ['extension.js', 'prefs.js', 'model.js', 'windowStore.js']]
runtime += sorted((root / 'shell').glob('*.js'))
for path in runtime:
    source = path.read_text()
    subprocess.run(['node', '--check', str(path)], check=True)
    assert not re.search(r'\bvertical\s*:', source), f'{path}: removed St vertical property'
    assert not re.search(r'import\s+.+\bfrom\s+[\'"]gi://(?:Gtk|Gdk|Adw)', source) or path.name == 'prefs.js'
    assert not re.search(r'import\s+.+\bfrom\s+[\'"]gi://(?:St|Clutter|Meta|Shell)', source) or path.name != 'prefs.js'
    assert not re.search(r'spawn|Subprocess|\.prototype\s*\[|\.run_dispose\(', source), f'{path}: review external execution or injection'
    assert max(map(len, source.splitlines())) <= 200, f'{path}: line exceeds review guidance'

print(f'Metadata, process boundaries, and syntax checked for {len(runtime)} runtime modules.')

