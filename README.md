# Mockup Scroller

A CLI tool that transforms static PNG mockups into animated GIFs with device frames and smooth scrolling.

## Example

```bash
# Input: A tall PNG mockup (e.g., a landing page design)
# Output: An animated GIF with iPhone frame and smooth scrolling

bun run dev --input "./landing-page.png" --out "./output"
```

This generates:

- `landing-page.framed.scroll.gif` - Animated scrolling version
- `landing-page.framed.static.png` - Static preview (first frame)

## Installation

### Prerequisites

1. [Bun](https://bun.sh) (v1.1.19+)
2. [FFmpeg](https://ffmpeg.org)

```bash
# Clone and install
git clone https://github.com/adpharm/mockup-scroller.git
cd mockup-scroller
bun install
```

## Usage

### Basic

```bash
bun run dev --input "./mockup.png" --out "./output"
```

### Batch Processing

```bash
bun run dev --input "./designs/*.png" --out "./output"
```

### Speed Control

```bash
# Slow (easier to read)
bun run dev --input "./mockup.png" --out "./output" --speed slow

# Normal (default)
bun run dev --input "./mockup.png" --out "./output" --speed normal

# Fast (quick preview)
bun run dev --input "./mockup.png" --out "./output" --speed fast
```

## How It Works

1. Takes a PNG mockup (typically exported from Figma)
2. Resizes it to fit iPhone SE viewport (750×1334px)
3. Adds device frame with rounded corners
4. Creates smooth scrolling animation if content is taller than viewport
5. Outputs optimized GIF with 1-second pauses at start/end for seamless looping

## Current Limitations

- Device: iPhone SE portrait only (more devices planned)
- Input: PNG files only (300×500px minimum, 20,000px max height)
- Output: GIF format at 800px width

## Development

```bash
# Run from source
bun run dev --input "./test.png" --out "./out"

# Build to JavaScript
bun run build

# Run compiled version
bun dist/src/cli.js --input "./test.png" --out "./out"
```

## License

MIT
