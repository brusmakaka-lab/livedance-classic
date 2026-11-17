from pathlib import Path
import json, hashlib

root = Path(__file__).resolve().parent.parent
ignored = {'node_modules', 'temp', 'logs', 'test-results', '.git', 'data-v06'}

def files(folder):
    for p in sorted(folder.iterdir()):
        if p.name in ignored or p.name.startswith('.profile') or p.is_junction() or p.is_symlink():
            continue
        if p.is_dir():
            yield from files(p)
        elif p.relative_to(root).as_posix() != 'docs/v06/manifest.json':
            yield p

entries = []
for p in files(root):
    data = p.read_bytes()
    entries.append({'path': p.relative_to(root).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
out = {'version': '0.6.0-connector.1', 'excludes': sorted(ignored) + ['profiles', 'junctions', 'manifest itself'], 'bytes': sum(x['bytes'] for x in entries), 'files': entries}
(root / 'docs/v06/manifest.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
print('Manifest:', len(entries), 'files,', round(out['bytes']/1048576, 2), 'MiB, excluding shared dependencies and runtime data')
