"""Reproducible, full-pixel Golden comparison. Never grants visual parity."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def compare(golden_dir, actual_dir, output_dir, spec_path, mask_path, states=None):
    spec = json.loads(spec_path.read_text(encoding='utf-8-sig'))
    mask_contract = json.loads(mask_path.read_text(encoding='utf-8-sig'))
    mask_manifest_sha = sha(mask_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for name, contract in spec['states'].items():
        if states and name[:2] not in states:
            continue
        golden_path, actual_path = golden_dir / name, actual_dir / name
        if sha(golden_path) != contract['goldenSHA256']:
            raise ValueError(f'Immutable Golden changed: {name}')
        x, y, width, height = contract['crop']
        with Image.open(golden_path) as source, Image.open(actual_path) as screenshot:
            if source.size != (941, 1672):
                raise ValueError(f'Unexpected Golden dimensions: {name}')
            viewport = contract['viewport']
            capture_size = tuple(v * contract['deviceScaleFactor'] for v in viewport)
            expected = tuple(viewport)
            if screenshot.size != capture_size:
                raise ValueError(f'{name}: actual {screenshot.size}, required {capture_size}; recapture canonical viewport')
            # One uniform scale, at most one output pixel of rounding. Never stretch X/Y independently.
            scale = expected[0] / width
            scaled_height = round(height * scale)
            if abs(scaled_height - expected[1]) > 2:
                raise ValueError(f'{name}: crop/viewport aspect mismatch')
            crop = source.crop((x, y, x + width, y + height)).convert('RGB')
            crop = crop.resize((expected[0], scaled_height), Image.Resampling.LANCZOS)
            derived = Image.new('RGB', expected, '#050506')
            derived.paste(crop, (0, 0))
            # Compare in canonical CSS-pixel viewport space. The original high-DPI
            # capture and SHA remain evidence; this normalization prevents device
            # scale rasterization from being mistaken for application geometry.
            actual = screenshot.convert('RGB').resize(expected, Image.Resampling.LANCZOS)
            difference = ImageChops.difference(derived, actual)
            raw_mae = sum(ImageStat.Stat(difference).mean) / 3
            maximum = ImageChops.lighter(ImageChops.lighter(*difference.split()[:2]), difference.split()[2])
            threshold = 24
            changed = maximum.point(lambda value: 255 if value > threshold else 0)
            raw_fraction = ImageStat.Stat(changed).mean[0] / 255
            declaration = mask_contract['states'][name]
            if declaration['viewport'] != viewport or declaration['deviceScaleFactor'] != contract['deviceScaleFactor']:
                raise ValueError(f'{name}: mask declaration does not match canonical viewport')
            mask = Image.new('L', expected, 0)
            mask_draw = ImageDraw.Draw(mask)
            factor = 1
            physical_regions = []
            for region in declaration['regions']:
                left, top = round(region['x'] * factor), round(region['y'] * factor)
                right, bottom = round((region['x'] + region['w']) * factor), round((region['y'] + region['h']) * factor)
                if left < 0 or top < 0 or right > expected[0] or bottom > expected[1] or right <= left or bottom <= top:
                    raise ValueError(f'{name}: invalid mask region {region}')
                mask_draw.rectangle((left, top, right - 1, bottom - 1), fill=255)
                physical_regions.append({**region, 'physical': {'x':left, 'y':top, 'w':right-left, 'h':bottom-top}})
            unmasked = ImageChops.invert(mask)
            unmasked_pixels = ImageStat.Stat(unmasked).sum[0] / 255
            if unmasked_pixels <= 0:
                raise ValueError(f'{name}: mask covers full screen')
            masked_difference = Image.composite(Image.new('RGB', expected, 'black'), difference, mask)
            sums = ImageStat.Stat(masked_difference).sum
            mae = sum(sums) / (3 * unmasked_pixels)
            masked_changed = Image.composite(Image.new('L', expected, 0), changed, mask)
            fraction = (ImageStat.Stat(masked_changed).sum[0] / 255) / unmasked_pixels
            # A fixed one-CSS-pixel neighborhood is reported separately for
            # font/raster edge placement. It never replaces the direct masked
            # metric or the full raw diff, and manual axis review remains required.
            spatial_source = Image.composite(Image.new('L', expected, 255), maximum, mask)
            spatial_error = spatial_source.filter(ImageFilter.MinFilter(3))
            spatial_error = Image.composite(Image.new('L', expected, 0), spatial_error, mask)
            spatial_changed = spatial_error.point(lambda value: 255 if value > threshold else 0)
            spatial_mae = ImageStat.Stat(spatial_error).sum[0] / unmasked_pixels
            spatial_fraction = (ImageStat.Stat(spatial_changed).sum[0] / 255) / unmasked_pixels
            coverage = (expected[0] * expected[1] - unmasked_pixels) / (expected[0] * expected[1])
            visible_diff = Image.blend(actual, Image.new('RGB', expected, '#ff2030'), .7)
            visible_diff = Image.composite(visible_diff, actual, masked_changed)
            paths = {}
            for folder, picture in [('derived-crops', derived), ('actual-normalized', actual), ('visual-diffs', visible_diff), ('raw-diffs', difference), ('masked-diffs', masked_difference), ('masks', mask)]:
                target = output_dir / folder / name
                target.parent.mkdir(parents=True, exist_ok=True)
                picture.save(target)
                paths[folder] = target
            sheet = Image.new('RGB', (expected[0] * 2, expected[1] + 48), '#151517')
            ImageDraw.Draw(sheet).text((12, 12), f'{name} | GOLDEN SCREEN / ACTUAL SCREEN', fill='white')
            sheet.paste(derived, (0, 48))
            sheet.paste(actual, (expected[0], 48))
            side = output_dir / 'side-by-side' / name
            side.parent.mkdir(parents=True, exist_ok=True)
            sheet.save(side)
            results.append(dict(
                state=name, goldenOriginal=str(golden_path), goldenSHA256=sha(golden_path),
                crop=dict(x=x, y=y, width=width, height=height), viewport=viewport,
                scale=scale, roundingPixels=expected[1]-scaled_height,
                derivedCrop=str(paths['derived-crops']), derivedCropSHA256=sha(paths['derived-crops']),
                actual=str(actual_path), actualSHA256=sha(actual_path), actualNormalized=str(paths['actual-normalized']), actualNormalizedSHA256=sha(paths['actual-normalized']), visualDiff=str(paths['visual-diffs']),
                visualDiffSHA256=sha(paths['visual-diffs']), rawDiff=str(paths['raw-diffs']), rawDiffSHA256=sha(paths['raw-diffs']),
                comparison=str(side), comparisonSHA256=sha(side),
                maskManifest=str(mask_path), maskManifestSHA256=mask_manifest_sha,
                mask=str(paths['masks']), maskSHA256=sha(paths['masks']), maskCoverage=round(coverage, 6),
                maskRegions=physical_regions, maskedDiff=str(paths['masked-diffs']), maskedDiffSHA256=sha(paths['masked-diffs']),
                sampleStep=1, channelThreshold=threshold, meanAbsoluteError=round(mae, 4),
                changedPixelRate=round(fraction, 6), rawMeanAbsoluteError=round(raw_mae, 4), rawChangedPixelRate=round(raw_fraction, 6),
                rasterizationRadiusCssPixels=1, rasterizationAdjustedMeanError=round(spatial_mae, 4),
                rasterizationAdjustedChangedPixelRate=round(spatial_fraction, 6),
                reviewStatus='FAIL_MATERIAL_DIFF' if spatial_mae > 12 or spatial_fraction > .08 else 'READY_FOR_MANUAL_REVIEW',
            ))
    manifest = output_dir / ('manifest.json' if not states else f'manifest-{"-".join(states)}.json')
    manifest.write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(f'{len(results)} comparisons; all pixels measured; manual eight-axis review required. {manifest}')
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('golden_dir', type=Path)
    parser.add_argument('actual_dir', type=Path)
    parser.add_argument('output_dir', type=Path)
    parser.add_argument('--spec', type=Path, default=Path('qa/v2.1/golden-screen-contract.json'))
    parser.add_argument('--masks', type=Path, default=Path('qa/v2.1/evidence/golden-region-mask-manifest.json'))
    parser.add_argument('--states', nargs='*')
    args = parser.parse_args()
    compare(args.golden_dir, args.actual_dir, args.output_dir, args.spec, args.masks, args.states)
