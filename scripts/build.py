#!/usr/bin/env python3
"""Generate classic GJS modules from shared source; do not transpile UI logic."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODERN_VERSIONS = [str(version) for version in range(45, 52)]
LEGACY_VERSIONS = ['3.32', '3.34', '3.36', '3.38'] + [str(version) for version in range(40, 45)]
RUNTIME = ['extension.js', 'prefs.js', 'model.js', 'unicodeMarks.js', 'shortcuts.js', 'windowStore.js',
           'shell/shelf.js', 'shell/thumbnail.js', 'shell/compat.js', 'shell/signals.js']


def classic_module(source):
    def replace_import(match):
        binding, location = match.groups()
        if location.startswith('gi://'):
            return f'const {binding} = imports.gi.{location[5:]};'
        if location.endswith('/extensions/extension.js'):
            return "const Gettext = imports.gettext.domain('tuck');\nconst _ = Gettext.gettext;\nconst ngettext = Gettext.ngettext;"
        if location.startswith('resource:///org/gnome/shell/'):
            location = location[len('resource:///org/gnome/shell/'):-3].replace('/', '.')
            alias = binding[5:] if binding.startswith('* as ') else binding
            return f'const {alias} = imports.{location};'
        location = re.sub(r'^\.\.?/', '', location[:-3]).replace('/', '.')
        if location in ('thumbnail', 'compat', 'signals'):
            location = 'shell.' + location
        return f'const {binding} = imports.misc.extensionUtils.getCurrentExtension().imports.{location};'
    source = re.sub(r"^import (.+) from ['\"](.+)['\"];", replace_import, source, flags=re.MULTILINE)
    source = re.sub(r'^export class (\w+)', r'var \1 = class \1', source, flags=re.MULTILINE)
    source = re.sub(r'^export const ', 'var ', source, flags=re.MULTILINE)
    source = re.sub(r'^export (?=(?:async )?function )', '', source, flags=re.MULTILINE)
    assert not re.search(r'^import |^export ', source, re.MULTILINE), 'Unconverted module syntax'
    return source


def stage_files(stage, legacy=False):
    metadata = json.loads((ROOT / 'metadata.json').read_text())
    metadata['shell-version'] = LEGACY_VERSIONS if legacy else MODERN_VERSIONS
    for name in RUNTIME:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        source = (ROOT / name).read_text()
        if legacy:
            source = (ROOT / 'legacy' / name).read_text() if name in ('extension.js', 'prefs.js') else classic_module(source)
        target.write_text(source)
    (stage / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    return metadata
