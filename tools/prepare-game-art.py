from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "assets" / "raw"
PUBLIC = ROOT / "public" / "assets"


def looks_like_checker(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, _ = pixel
    spread = max(red, green, blue) - min(red, green, blue)
    brightness = (red + green + blue) // 3
    return spread <= 16 and 138 <= brightness <= 252


def remove_connected_checker(source: Image.Image) -> Image.Image:
    image = source.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    queue: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def offer(x: int, y: int) -> None:
        offset = y * width + x
        if not visited[offset] and looks_like_checker(pixels[x, y]):
            visited[offset] = 1
            queue.append((x, y))

    for x in range(width):
        offer(x, 0)
        offer(x, height - 1)
    for y in range(height):
        offer(0, y)
        offer(width - 1, y)

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (0, 0, 0, 0)
        if x > 0:
            offer(x - 1, y)
        if x + 1 < width:
            offer(x + 1, y)
        if y > 0:
            offer(x, y - 1)
        if y + 1 < height:
            offer(x, y + 1)
    return image


def remove_bright_neutral_halo(source: Image.Image) -> Image.Image:
    image = source.copy().convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            brightness = (red + green + blue) // 3
            if alpha and brightness >= 190 and max(red, green, blue) - min(red, green, blue) <= 20:
                pixels[x, y] = (0, 0, 0, 0)
    return image


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    box = image.getchannel("A").getbbox()
    if box is None:
        raise ValueError("asset became empty during background removal")
    return box


def remove_small_components(image: Image.Image, minimum_area: int) -> Image.Image:
    result = image.copy()
    alpha = result.getchannel("A")
    width, height = result.size
    visited = bytearray(width * height)
    pixels = alpha.load()
    for start_y in range(height):
        for start_x in range(width):
            start = start_y * width + start_x
            if visited[start] or pixels[start_x, start_y] == 0:
                continue
            queue = deque([(start_x, start_y)])
            visited[start] = 1
            component: list[tuple[int, int]] = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < width and 0 <= ny < height:
                        offset = ny * width + nx
                        if not visited[offset] and pixels[nx, ny] > 0:
                            visited[offset] = 1
                            queue.append((nx, ny))
            if len(component) < minimum_area:
                for x, y in component:
                    result.putpixel((x, y), (0, 0, 0, 0))
    return result


def detect_frame_ranges(source: Image.Image, expected_frames: int) -> list[tuple[int, int]]:
    rgb = source.convert("RGB")
    separator_columns: list[int] = []
    for x in range(rgb.width):
        dark_neutral = 0
        for y in range(rgb.height):
            red, green, blue = rgb.getpixel((x, y))
            if max(red, green, blue) - min(red, green, blue) < 18 and (red + green + blue) // 3 < 165:
                dark_neutral += 1
        if dark_neutral > rgb.height * 0.72:
            separator_columns.append(x)

    groups: list[list[int]] = []
    for column in separator_columns:
        if not groups or column > groups[-1][-1] + 1:
            groups.append([column])
        else:
            groups[-1].append(column)
    if len(groups) != expected_frames - 1:
        raise ValueError(f"expected {expected_frames - 1} separators, found {len(groups)}")

    ranges: list[tuple[int, int]] = []
    left = 0
    for group in groups:
        ranges.append((left, group[0]))
        left = group[-1] + 1
    ranges.append((left, source.width))
    return ranges


def normalize_many(frames: list[Image.Image], frame_size: int, max_width: int, max_height: int, baseline: int) -> list[Image.Image]:
    crops = [frame.crop(alpha_bbox(frame)) for frame in frames]
    scale = min(
        min(max_width / crop.width, max_height / crop.height)
        for crop in crops
    )
    normalized: list[Image.Image] = []
    for crop in crops:
        size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        resized = crop.resize(size, Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
        x = (frame_size - resized.width) // 2
        y = baseline - resized.height
        canvas.alpha_composite(resized, (x, y))
        normalized.append(canvas)
    return normalized


def save_strip(frames: list[Image.Image], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    width, height = frames[0].size
    strip = Image.new("RGBA", (width * len(frames), height), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * width, 0))
    strip.save(output)


def prepare_animation(name: str) -> None:
    source = Image.open(RAW / f"squire-{name}.png").convert("RGBA")
    frame_count = 6
    frames: list[Image.Image] = []
    for index, (left, right) in enumerate(detect_frame_ranges(source, frame_count)):
        frame = source.crop((left + 3, 3, right - 3, source.height - 3))
        if index == frame_count - 1:
            # The generator signature is isolated in the lower-right corner.
            frame.paste((205, 205, 205, 255), (frame.width - 86, frame.height - 86, frame.width, frame.height))
        frames.append(remove_connected_checker(frame))

    normalized = normalize_many(frames, frame_size=128, max_width=112, max_height=116, baseline=122)
    directory = PUBLIC / "characters" / "squire" / name
    directory.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(normalized, start=1):
        frame.save(directory / f"{index:02}.png")
    save_strip(normalized, PUBLIC / "characters" / "squire" / f"{name}-strip.png")


def prepare_slime() -> None:
    source = Image.open(RAW / "receipt-slime.png").convert("RGBA")
    source.paste((205, 205, 205, 255), (source.width - 150, source.height - 150, source.width, source.height))
    cleaned = remove_small_components(remove_connected_checker(source), minimum_area=80)
    [normalized] = normalize_many([cleaned], frame_size=256, max_width=224, max_height=210, baseline=238)
    normalized.save(PUBLIC / "characters" / "enemies" / "receipt-slime.png")


ITEM_NAMES = [
    "rusty-sword", "wooden-shield", "short-bow", "metal-shield", "arcane-aegis",
    "ember-orb", "mending-light", "essence", "tax-seal", "lock-closed",
    "coin", "lock-open", "lock-closed-alt", "reroll", "activate",
]


def prepare_items() -> None:
    source = Image.open(RAW / "items.png").convert("RGBA")
    output = PUBLIC / "items"
    output.mkdir(parents=True, exist_ok=True)
    for row in range(3):
        for column in range(5):
            left = round(column * source.width / 5)
            right = round((column + 1) * source.width / 5)
            top = round(row * source.height / 3)
            bottom = round((row + 1) * source.height / 3)
            cell = source.crop((left + 48, top + 38, right - 18, bottom - 20))
            if row == 2 and column == 4:
                cell.paste((205, 205, 205, 255), (cell.width - 45, cell.height - 45, cell.width, cell.height))
            cleaned = remove_connected_checker(cell)
            cleaned = remove_bright_neutral_halo(cleaned)
            cleaned = remove_small_components(cleaned, minimum_area=120)
            [normalized] = normalize_many([cleaned], frame_size=128, max_width=104, max_height=104, baseline=116)
            normalized.save(output / f"{ITEM_NAMES[row * 5 + column]}.png")


def prepare_background() -> None:
    source = Image.open(RAW / "library.png").convert("RGB")
    # Crop only the generator mark in the lower-right, preserving the 2:1 playfield composition.
    source.crop((0, 0, 1344, 672)).save(PUBLIC / "environment" / "arcane-library.png", optimize=True)


def main() -> None:
    prepare_animation("idle")
    prepare_animation("attack")
    prepare_slime()
    prepare_items()
    prepare_background()
    print("Prepared 2 animation strips, 12 hero frames, 1 enemy, 15 icons, and 1 background.")


if __name__ == "__main__":
    main()
