"""Verify portable references, model parity, and documented color tokens.
Run from any directory: python path/to/viewer/verify_viewer.py
"""
from pathlib import Path
from html.parser import HTMLParser
import base64
import json
import math
import re
import struct
import sys

ROOT = Path(__file__).resolve().parent
failures = []
checks = []


def check(condition, label):
    (checks if condition else failures).append(label)


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []
        self.ids = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag in ('script', 'img') and attrs.get('src'):
            self.paths.append(attrs['src'])
        if tag == 'link' and attrs.get('href'):
            self.paths.append(attrs['href'])


def assignment_json(path, variable):
    text = path.read_text(encoding='utf-8')
    match = re.search(r'(?:window\.)?' + re.escape(variable) + r'\s*=\s*', text)
    if not match:
        raise ValueError(f'No {variable} assignment')
    return json.JSONDecoder().raw_decode(text[match.end():])[0]


def validate():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    app = (ROOT / 'assets/app.js').read_text(encoding='utf-8')
    css = (ROOT / 'assets/style.css').read_text(encoding='utf-8')
    doc = (ROOT / 'DESIGN.md').read_text(encoding='utf-8')
    refs = References(); refs.feed(html)
    check(len(refs.ids) == len(set(refs.ids)), 'HTML IDs are unique')
    for ref in refs.paths:
        check(not re.match(r'^(https?:)?//', ref), f'Local runtime resource: {ref}')
        check((ROOT / ref).is_file(), f'Resource exists: {ref}')
    for ref in re.findall(r'url\([\'"]?([^\)\'\"]+)', css):
        check(not ref.startswith(('http:', 'https:', '//')), f'Local CSS resource: {ref}')
        check((ROOT / 'assets' / ref).is_file(), f'CSS resource exists: {ref}')
    for forbidden in (r'\balert\s*\(', r'\bconfirm\s*\(', r'\bprompt\s*\('):
        check(not re.search(forbidden, app), f'No native blocking dialog: {forbidden}')
    check('aria-live="polite"' in html, 'Persistent polite live status')
    check('prefers-reduced-motion:reduce' in css, 'Reduced motion styles')
    check('scrollbar-color:' in css and 'forced-colors:active' in css, 'Global scrollbar and forced colors styles')
    check('ticket !== requestVersion' in app, 'Superseded model loads are ignored')
    for selector in re.findall(r"\$\('#([^']+)'\)", app):
        check(selector.split()[0] in refs.ids, f'JS target exists: {selector}')
    colors = doc.split('colors:\n', 1)[1].split('typography:', 1)[0]
    for name, value in re.findall(r'  ([\w-]+): "(#[0-9a-f]+)"', colors):
        match = re.search(r'--color-' + re.escape(name) + r':(#[0-9a-f]+)', css)
        check(bool(match and match.group(1) == value), f'Documented color token: {name}')
    vercel = json.loads((ROOT / 'vercel.json').read_text())
    check(vercel['framework'] is None and vercel['buildCommand'] == '' and vercel['outputDirectory'] == '.', 'Vercel static root configuration')
    catalog = assignment_json(ROOT / 'assets/catalog.js', 'PL_CATALOG')
    assets = catalog['assets']
    check(len(assets) == 8, 'Eight asset groups')
    check(len({a['id'] for a in assets}) == len(assets), 'Unique asset IDs')
    bundle = catalog.get('bundle')
    shared_json = None
    if bundle:
        glb_path = ROOT / bundle['file']
        check(glb_path.is_file(), 'Shared GLB exists')
        raw = glb_path.read_bytes()
        check(len(raw) > 20 and raw[:4] == b'glTF', 'Shared GLB header')
        version, size = struct.unpack_from('<II', raw, 4)
        check(version == 2 and size == len(raw), 'Shared GLB version/size')
        json_size, chunk_type = struct.unpack_from('<II', raw, 12)
        check(chunk_type == 0x4E4F534A, 'Shared GLB JSON chunk')
        shared_json = json.loads(raw[20:20 + json_size].decode('utf-8').rstrip(' \x00'))
        check(not any(buffer.get('uri') for buffer in shared_json.get('buffers', [])), 'Shared buffers are embedded')
        chunks = []
        for index, name in enumerate(bundle['scripts']):
            check(not name.startswith(('http:', 'https:', '//')), f'Local shared script: {index}')
            script_path = ROOT / name
            check(script_path.is_file(), f'Shared script exists: {index}')
            check(script_path.stat().st_size <= 12 * 1024 * 1024, f'Shared script upload size: {index}')
            script = script_path.read_text(encoding='utf-8')
            pattern = r"(?:window\.)?PL_SHARED_PARTS\s*\[\s*" + str(index) + r"\s*\]\s*=\s*['\"]([A-Za-z0-9+/=]+)['\"]"
            match = re.search(pattern, script)
            check(bool(match), f'Shared chunk assignment: {index}')
            if match:
                chunks.append(match.group(1))
        check(base64.b64decode(''.join(chunks), validate=True) == raw, 'Shared scripts/GLB byte parity')
        for index, node in enumerate(shared_json.get('nodes', [])):
            for field, length in [('matrix', 16), ('translation', 3), ('rotation', 4), ('scale', 3)]:
                if field in node:
                    values = node[field]
                    check(len(values) == length and all(isinstance(v, (int, float)) and math.isfinite(v) for v in values), f'Shared node {index} finite {field}')
    state_count = 0
    scene_indices = set()
    for asset in assets:
        check(bool(asset['states']), f"States exist: {asset['id']}")
        check((ROOT / f"assets/previews/{asset['id']}.png").is_file(), f"Fallback exists: {asset['id']}")
        for state in asset['states']:
            state_count += 1
            key = state.get('key', f"{asset['id']}_{state['id']}")
            if bundle:
                index = state.get('scene_index')
                valid = isinstance(index, int) and 0 <= index < len(shared_json.get('scenes', []))
                check(valid, f'Shared scene index: {key}')
                check(index not in scene_indices, f'Unique shared scene index: {key}')
                scene_indices.add(index)
                if valid:
                    nodes = shared_json['scenes'][index].get('nodes', [])
                    check(bool(nodes) and all(isinstance(node, int) and 0 <= node < len(shared_json['nodes']) for node in nodes), f'Shared scene nodes: {key}')
            else:
                glb_path = ROOT / state.get('file', f'models/{key}.glb')
                js_path = ROOT / state.get('script', str(glb_path.relative_to(ROOT)).replace('.glb', '.js'))
                if not glb_path.is_file() or not js_path.is_file():
                    check(False, f'Model pair exists: {key}'); continue
                raw = glb_path.read_bytes()
                check(len(raw) > 20 and raw[:4] == b'glTF', f'GLB header: {key}')
                if raw[:4] != b'glTF':
                    continue
                version, size = struct.unpack_from('<II', raw, 4)
                check(version == 2 and size == len(raw), f'GLB version/size: {key}')
                script = js_path.read_text(encoding='utf-8')
                match = re.search(r"(?:window\.)?PL_MODELS\s*\[\s*['\"]" + re.escape(key) + r"['\"]\s*\]\s*=\s*['\"]([A-Za-z0-9+/=]+)['\"]", script)
                check(bool(match), f'Model JS assignment: {key}')
                if match:
                    check(base64.b64decode(match.group(1)) == raw, f'JS/GLB byte parity: {key}')
            dimensions = state.get('dimensions_mm', [])
            check(len(dimensions) == 3 and all(isinstance(v, (int, float)) and v > 0 for v in dimensions), f'Positive dimensions: {key}')
    check(state_count >= 17, f'Complete state inventory ({state_count})')
    if bundle:
        check(len(shared_json['scenes']) == state_count, 'Shared scene count matches state inventory')


try:
    validate()
except Exception as error:
    failures.append(f'Validation could not finish: {error}')
result = {'passed': not failures, 'checks_passed': len(checks), 'failures': failures}
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(0 if result['passed'] else 1)
