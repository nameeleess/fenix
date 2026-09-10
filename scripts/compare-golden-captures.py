"""Evidence composition only: originals remain unchanged; never assigns parity."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument('goldens', type=Path)
parser.add_argument('evidence', type=Path)
args = parser.parse_args()
output = args.evidence / 'golden-comparisons'
output.mkdir(parents=True, exist_ok=True)
manifest = []
for golden in sorted(args.goldens.glob('*.png')):
    actual = args.evidence / 'screenshots' / golden.name
    if not actual.exists():
        raise FileNotFoundError(actual)
    canvas = Image.new('RGB', (1420, 1480), '#171719')
    draw = ImageDraw.Draw(canvas)
    draw.text((20, 14), golden.name, fill='white')
    for x, source, label in [(10, golden, 'GOLDEN (immutable, with original frame)'), (715, actual, 'ACTUAL (browser viewport)')]:
        draw.text((x + 10, 42), label, fill='white')
        with Image.open(source) as original:
            thumb = ImageOps.contain(original.convert('RGB'), (690, 1380))
            canvas.paste(thumb, (x + (690 - thumb.width) // 2, 75))
    target = output / golden.name
    canvas.save(target)
    manifest.append({
        'state': golden.name,
        'golden': str(golden.resolve()),
        'goldenSHA256': hashlib.sha256(golden.read_bytes()).hexdigest(),
        'actual': str(actual.resolve()),
        'actualSHA256': hashlib.sha256(actual.read_bytes()).hexdigest(),
        'comparison': str(target.resolve()),
        'method': 'Uniform contain resize; no cropping, retouching or generated content',
        'parity': 'NOT_ASSIGNED_BY_CAPTURE_TOOL',
    })
if len(manifest) != 26:
    raise ValueError(f'Expected 26 states, found {len(manifest)}')
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print('26 evidence comparisons generated. Visual parity requires separate review.')
