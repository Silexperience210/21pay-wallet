"""Generate 21pay wallet launch assets with Pillow."""
from PIL import Image, ImageDraw, ImageFont
import os

# Colors
BG = (5, 5, 5)
BADGE_BG = (10, 10, 10)
ORANGE = (247, 147, 26)
ORANGE_LIGHT = (255, 174, 66)
WHITE = (250, 250, 250)
BLACK = (5, 5, 5)

def rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def draw_badge(draw, cx, cy, size, radius, border_width):
    """Draw the rounded badge outline + inner ring."""
    half = size // 2
    x1, y1 = cx - half, cy - half
    x2, y2 = cx + half, cy + half
    rounded_rect(draw, (x1, y1, x2, y2), radius, BADGE_BG, ORANGE, border_width)
    # Inner subtle ring
    pad = size // 12
    rounded_rect(draw, (x1 + pad, y1 + pad, x2 - pad, y2 - pad),
                 radius - pad, None, ORANGE, max(1, border_width // 4))

def draw_bolt(draw, cx, cy, scale):
    """Draw stylized lightning bolt polygon."""
    # Original SVG points relative to 512x512 artboard, centered around (512,512)
    # M 562 252 L 382 560 L 500 560 L 462 772 L 642 464 L 524 464 Z
    # Center offset: subtract (512, 512) to make relative to center
    pts = [
        (562 - 512, 252 - 512),
        (382 - 512, 560 - 512),
        (500 - 512, 560 - 512),
        (462 - 512, 772 - 512),
        (642 - 512, 464 - 512),
        (524 - 512, 464 - 512),
    ]
    scaled = [(cx + x * scale, cy + y * scale) for x, y in pts]
    draw.polygon(scaled, fill=ORANGE)

def get_font(size, bold=False):
    """Try to load a system font, fall back to default."""
    candidates = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def make_icon(size=1024):
    img = Image.new('RGBA', (size, size), BG)
    draw = ImageDraw.Draw(img)

    # Subtle radial gradient approximation: draw concentric rects with slight color changes
    for i in range(20, 0, -1):
        factor = i / 20
        c = (int(5 + 6 * (1 - factor)), int(5 + 6 * (1 - factor)), int(5 + 6 * (1 - factor)))
        margin = int(size * 0.05 * (20 - i) / 20)
        draw.rectangle([margin, margin, size - margin, size - margin], fill=c)

    cx, cy = size // 2, size // 2
    badge_size = int(size * 0.78)
    badge_radius = int(badge_size * 0.28)
    draw_badge(draw, cx, cy, badge_size, badge_radius, max(6, size // 100))

    # Bolt (scaled down to fit inside badge)
    bolt_scale = size * 0.58 / 512
    draw_bolt(draw, cx, int(cy - size * 0.02), bolt_scale)

    # 21 text centered in bolt
    font_21 = get_font(int(size * 0.16), bold=True)
    text = "21"
    bbox = draw.textbbox((0, 0), text, font=font_21)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw / 2, cy - th / 2 - size * 0.02), text, font=font_21, fill=BLACK)

    return img

def make_splash(size=1242):
    img = Image.new('RGBA', (size, size), BG)
    draw = ImageDraw.Draw(img)

    # Gradient approximation
    for i in range(20, 0, -1):
        factor = i / 20
        c = (int(5 + 5 * (1 - factor)), int(5 + 5 * (1 - factor)), int(5 + 5 * (1 - factor)))
        margin = int(size * 0.08 * (20 - i) / 20)
        draw.rectangle([margin, margin, size - margin, size - margin], fill=c)

    cx, cy = size // 2, size // 2
    badge_size = int(size * 0.48)
    badge_radius = int(badge_size * 0.28)
    draw_badge(draw, cx, cy, badge_size, badge_radius, max(5, size // 130))

    # Bolt (scaled to fit inside badge)
    bolt_scale = size * 0.52 / 512
    draw_bolt(draw, cx, cy - size * 0.015, bolt_scale)

    # 21 text
    font_21 = get_font(int(size * 0.12), bold=True)
    text = "21"
    bbox = draw.textbbox((0, 0), text, font=font_21)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw / 2, cy - th / 2 - size * 0.015), text, font=font_21, fill=BLACK)

    return img

def make_adaptive_icon(size=1024):
    # Foreground only, transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2
    badge_size = int(size * 0.78)
    badge_radius = int(badge_size * 0.28)
    draw_badge(draw, cx, cy, badge_size, badge_radius, max(6, size // 100))

    draw_bolt(draw, cx, int(cy - size * 0.02), size / 512)

    font_21 = get_font(int(size * 0.21), bold=True)
    text = "21"
    bbox = draw.textbbox((0, 0), text, font=font_21)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw / 2, cy - th / 2 - size * 0.02), text, font=font_21, fill=BLACK)

    return img

def make_splash_logo(size=512):
    # Logo on transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2
    badge_size = int(size * 0.78)
    badge_radius = int(badge_size * 0.28)
    draw_badge(draw, cx, cy, badge_size, badge_radius, max(4, size // 80))

    draw_bolt(draw, cx, int(cy - size * 0.02), size / 512)

    font_21 = get_font(int(size * 0.21), bold=True)
    text = "21"
    bbox = draw.textbbox((0, 0), text, font=font_21)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw / 2, cy - th / 2 - size * 0.02), text, font=font_21, fill=BLACK)

    return img

if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    print("Generating 21pay assets...")
    make_icon(1024).save(os.path.join(base, 'icon.png'), 'PNG')
    make_splash(1242).save(os.path.join(base, 'splash.png'), 'PNG')
    make_adaptive_icon(1024).save(os.path.join(base, 'adaptive-icon.png'), 'PNG')
    make_splash_logo(512).save(os.path.join(base, 'splash-logo.png'), 'PNG')
    print("Done:")
    for name in ['icon.png', 'splash.png', 'adaptive-icon.png', 'splash-logo.png']:
        path = os.path.join(base, name)
        print(f"  {name}: {os.path.getsize(path)} bytes")
