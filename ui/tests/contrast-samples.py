"""Resolve contrast checks against screenshots with text temporarily hidden."""
import json, sys
from PIL import Image
samples = json.load(sys.stdin)
image = Image.open(sys.argv[1]).convert('RGB')
def luminance(rgb):
    values = [c / 255 for c in rgb]
    values = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in values]
    return sum(a * b for a, b in zip(values, (.2126, .7152, .0722)))
failures = []
for sample in samples:
    ratios = []
    for x, y in sample['points']:
        background = image.getpixel((min(image.width-1,max(0,int(x))),min(image.height-1,max(0,int(y)))))
        foreground = [f*sample['alpha']+b*(1-sample['alpha']) for f,b in zip(sample['color'],background)]
        light, dark = sorted((luminance(foreground), luminance(background)), reverse=True)
        ratios.append((light+.05)/(dark+.05))
    if min(ratios) + .02 < sample['required']:
        failures.append({'text': sample['text'], 'ratio': round(min(ratios),2), 'required': sample['required']})
print(json.dumps({'checked':len(samples),'failures':failures}))
