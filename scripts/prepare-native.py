#!/usr/bin/env python3
"""Prepare the classic-loader variant of the native suite in a disposable checkout."""
import argparse
import pathlib
import subprocess
from build import ROOT, LEGACY_VERSIONS, classic_module

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--shell-version', required=True, help='For example 3.32, 42, or 44')
parser.add_argument('--resource', help='Extensions source gresource, or the old extension-prefs ELF binary')
args = parser.parse_args()
version = tuple(map(int, args.shell_version.split('.')[:2]))
major = version[0]
assert args.shell_version in LEGACY_VERSIONS, 'Choose a supported classic Shell version from 3.32 through 44'
source = (ROOT / 'tests/compatibility.js').read_text()
source = source.replace("import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';", 'const Extension = null;')
source = source.replace('return Extension.lookupByUUID(uuid);',
    'const object = Main.extensionManager ? Main.extensionManager.lookup(uuid) : imports.misc.extensionUtils.extensions[uuid];\n'
    '    return object && object.stateObj;')
source = classic_module(source.replace('export async function', 'async function')).replace('console.log(', 'print(')
if version < (3, 38):
    source = source.replace('async function run()', 'function* run()').replace('await Scripting.', 'yield Scripting.')
gtk = '3.0' if major == 3 else '4.0'
source = source.replace("'/tmp/tuck/tests/classicPreferences.js', path]", f"'/tmp/tuck/tests/classicPreferences.js', path, '{gtk}']")
perf = ROOT / 'tests/perf'
perf.mkdir(exist_ok=True)
(perf / 'compat.js').write_text(source)
(ROOT / 'tests/classicChecks.js').write_text(classic_module((ROOT / 'tests/preferencesChecks.js').read_text()))
resource = pathlib.Path(args.resource or '/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource')
if not resource.exists():
    resource = pathlib.Path('/usr/bin/gnome-shell-extension-prefs')
paths = subprocess.check_output(['gresource', 'list', str(resource)], text=True).splitlines()
for name in paths:
    if '/misc/' in name and name.endswith('.js'):
        target = ROOT / 'tests/classic-host/misc' / name.split('/misc/', 1)[1]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(subprocess.check_output(['gresource', 'extract', str(resource), name]))
print(f'Prepared classic suite for GNOME {args.shell_version} / GTK {gtk}')
