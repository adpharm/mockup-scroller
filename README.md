# Mockup Scroller

A CLI tool that transforms static PNG mockups into animated GIFs with device frames and smooth scrolling.

## What's New

See [CHANGELOG.md](./CHANGELOG.md) for recent updates and version history.

## Example

```bash
# Input: A tall PNG mockup (e.g., a landing page design)
# Output: An animated GIF with iPhone frame and smooth scrolling

bun run dev --input "./landing-page.png" --out "./output"
```

This generates:

- `landing-page.framed.scroll.gif` - Animated scrolling version with human-like scrolling
- `landing-page.framed.1.png` - First framed segment (with bezel)
- `landing-page.framed.2.png` - Second framed segment (etc.)
- `landing-page.screen.1.png` - First screen segment (no bezel)
- `landing-page.screen.2.png` - Second screen segment (etc.)

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

### Options

```bash
# Disable segment generation (GIF only)
bun run dev --input "./mockup.png" --out "./output" --no-segments

# Custom screen segment height (default: 1600px)
bun run dev --input "./mockup.png" --out "./output" --screen-height 2000
```

## How It Works

1. Takes a PNG mockup (typically exported from Figma)
2. Resizes it to fit iPhone SE viewport (750×1334px)
3. Adds device frame with rounded corners
4. Creates human-like scrolling animation with natural burst-and-pause patterns
5. Generates multiple screen segments for easy sharing
6. Outputs optimized GIF with smooth pauses for seamless looping

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
