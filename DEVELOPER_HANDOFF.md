# Developer Handoff Document - Mockup Scroller

**Date:** August 28, 2024  
**Project:** mockup-scroller  
**Version:** 0.2.0 (MVP Enhanced with Smooth Scrolling & Optimizations)

## Table of Contents
1. [Project Overview](#project-overview)
2. [Business Context](#business-context)
3. [Technical Architecture](#technical-architecture)
4. [Project Structure](#project-structure)
5. [Core Implementation Details](#core-implementation-details)
6. [Current Features](#current-features)
7. [Known Issues and Gotchas](#known-issues-and-gotchas)
8. [Setup and Development](#setup-and-development)
9. [Testing](#testing)
10. [Future Enhancements](#future-enhancements)
11. [Important Design Decisions](#important-design-decisions)

## Project Overview

**mockup-scroller** is a CLI tool that transforms static PNG mockups (typically exported from Figma) into animated GIFs showing the mockup within a device bezel with scrolling animation. The MVP focuses exclusively on iPhone SE portrait orientation.

### What It Does
1. Takes PNG files as input (typically mobile/web mockups from Figma)
2. Frames them within an iPhone SE bezel
3. Creates a smooth scrolling animation if content is taller than viewport
4. Outputs both an animated GIF and a static PNG preview

### Key Specifications
- **Device:** iPhone SE (portrait only)
- **Canvas Size:** 1000×2000px (scaled to 800px width in GIF for file size)
- **Viewport Size:** 750×1334px at position (125, 333)
- **Animation:** Adaptive duration (up to 9s), 30 FPS, smooth scrolling
- **Scroll Speed:** ~20-25 pixels per frame for smooth motion
- **Output Formats:** GIF (animated, 80% scale) + PNG (static preview, full size)

## Business Context

This tool was created to automate the process of creating device-framed mockup presentations. Designers often export screens from Figma and need to show them in a device context with scrolling to demonstrate long-form content. This tool eliminates the manual work of:
- Adding device frames in design tools
- Creating scrolling animations
- Exporting to shareable formats

The MVP was intentionally scoped to a single device (iPhone SE) to establish the core architecture before expanding to multiple devices.

## Technical Architecture

### Technology Stack
- **Runtime:** Bun 1.2.21
- **Language:** TypeScript 5.5.x
- **Key Dependencies:**
  - `sharp@0.33.x` - Image processing (resize, crop, composite, mask)
  - `commander@12.x` - CLI argument parsing
  - `globby@14.x` - File pattern matching
  - `execa@9.x` - ffmpeg process execution
  - `zod@3.x` - Input validation
- **External Requirement:** ffmpeg (system-installed)

### Architecture Overview

```
Input PNG(s) → Validation → Resize → Frame Generation → GIF Encoding → Output
                    ↓           ↓            ↓               ↓
                fileio.ts   image.ts    animate.ts      encode.ts
```

The tool follows a pipeline architecture:
1. **CLI Layer** (`cli.ts`) - Argument parsing, validation, ffmpeg check
2. **Orchestration** (`main.ts`) - Sequential file processing, error handling
3. **File I/O** (`fileio.ts`) - File discovery, PNG verification, path sanitization
4. **Image Processing** (`image.ts`) - Resize, crop, mask, composite operations
5. **Animation** (`animate.ts`) - Frame generation, scroll calculation
6. **Encoding** (`encode.ts`) - ffmpeg GIF creation, cleanup

## Project Structure

```
mockup-scroller/
├── src/
│   ├── cli.ts              # CLI entry point, argument parsing
│   ├── main.ts             # Main orchestration logic
│   ├── fileio.ts           # File operations utilities
│   ├── image.ts            # Image processing functions
│   ├── animate.ts          # Animation frame generation
│   ├── encode.ts           # GIF encoding with ffmpeg
│   └── bezel/
│       ├── device-meta.ts  # Device specifications and SVG buffers
│       └── svg/
│           ├── bezel.svg   # Device frame with screen cutout
│           └── mask.svg    # Screen corner radius mask
├── dist/                   # Compiled JavaScript output
├── out/                    # Generated GIFs and PNGs (gitignored)
├── test-input/             # Sample input PNGs (gitignored)
├── assets/
│   └── README.md           # Device assets documentation
├── package.json            # Dependencies and scripts
├── bunfig.toml            # Bun configuration
├── tsconfig.json          # TypeScript configuration
├── MVP_IMPLEMENTATION_PLAN_AUG_28.md  # Original specification
└── IMPLEMENTATION_STATUS.md # Current implementation status
```

## Core Implementation Details

### 1. Image Processing Pipeline

**Resize Operation (`image.ts:26-34`)**
- Resizes input PNG to exactly 750px width
- Preserves aspect ratio
- Uses `withoutEnlargement: false` to allow upscaling

**Frame Rendering (`animate.ts:34-84`)**
- Pre-renders bezel SVG to PNG once per run (performance optimization)
- Generates adaptive frame count based on scroll distance
- Each frame:
  1. Crops content at calculated Y offset
  2. Applies rounded corner mask (40px radius)
  3. Composites onto canvas with background
  4. Overlays bezel frame

### 2. Adaptive Scroll Animation (NEW)

**Smooth Scrolling Implementation (`animate.ts:9-36`)**
```typescript
const TARGET_PPF = 21.5;   // Target pixels per frame for smooth motion
const MIN_FRAMES = 150;    // Minimum 5 seconds animation
const MAX_FRAMES = 270;    // Maximum 9 seconds (performance cap)

// Adaptive frame calculation:
- If no scrolling needed: 180 frames (6s) of static content
- If scrolling: Calculate frames to achieve ~21.5 px/frame
- Capped at 270 frames (9s) for very tall content
- Result: Smooth, readable scrolling at consistent speed
```

### 3. File Size Optimization (NEW)

**PNG Frame Compression (`image.ts`)**
- Compression level 6 (balanced speed/size)
- Quality set to 85% for smaller files
- Applied to both masked content and final composite

**GIF Optimization (`encode.ts`)**
- Output scaled to 800px width (80% of original)
- Floyd-Steinberg dithering for quality/size balance
- Two-pass encoding with optimized palette generation
- Result: ~26% file size reduction (53MB → 39MB typical)

### 4. GIF Encoding Strategy

**Two-Pass ffmpeg Approach (`encode.ts`)**
1. First pass: Generate optimal palette with `stats_mode=diff`
2. Second pass: Scale to 80% and apply palette with Floyd-Steinberg dithering
3. Uses numbered sequence pattern (`%06d.png`)

### 5. Critical SVG Elements

**Bezel SVG** (`bezel/svg/bezel.svg`)
- Uses SVG mask to create transparent screen cutout
- Screen area: x=125, y=333, width=750, height=1334
- Important: Must remain transparent except for device frame

**Mask SVG** (`bezel/svg/mask.svg`)
- Simple rounded rectangle (40px radius)
- Used with `dest-in` blend mode for corner rounding

### 6. Error Handling

The tool uses specific exit codes:
- `0` - Success
- `2` - Validation error (bad arguments, no PNGs found)
- `3` - Environment error (ffmpeg missing)
- `4` - Processing error (continues processing other files)

## Current Features

### Completed (MVP)
✅ Single device support (iPhone SE portrait)  
✅ PNG input validation (dimensions, format)  
✅ Automatic resizing to viewport width  
✅ Linear scroll animation (6s, 30 FPS)  
✅ Rounded screen corners (40px radius)  
✅ Two-output generation (GIF + static PNG)  
✅ Batch processing support  
✅ Proper error handling and logging  
✅ TypeScript compilation to JavaScript  

### Input Constraints
- Min dimensions: 300×500px
- Max height: 20,000px
- Format: PNG only
- File size: > 1KB

## Known Issues and Gotchas

### 1. Bezel Transparency Issue (FIXED)
**Original Issue:** Bezel SVG initially had opaque rectangle covering screen area  
**Solution:** Updated to use SVG mask with screen cutout  
**File:** `src/bezel/svg/bezel.svg` and embedded version in `device-meta.ts`

### 2. Output File Sizes (OPTIMIZED)
- GIFs now ~30-40MB for tall mockups with 270 frames (9s animation)
- Optimization applied: 80% scaling reduces file size by ~26%
- Static PNG: ~250KB (compressed from 1.3MB)
- Trade-off: Slight quality reduction for significant size savings

### 3. Mockup Content Appearance
- Tool respects whatever is in the source PNG
- If mockup includes browser chrome or has built-in padding, this is preserved
- Tool does NOT crop or detect content boundaries

### 4. Performance Considerations
- Processes files sequentially to avoid memory spikes
- Each frame is written to disk immediately
- Temp frames are cleaned up after GIF creation
- 270 frames (9s) takes ~50-60s to process on typical hardware
- PNG compression set to level 6 for balance of speed/size

### 5. ffmpeg Dependency
- Must be installed separately on the system
- Tool checks for availability and exits gracefully if missing
- Version 4.4+ recommended

## Setup and Development

### Prerequisites
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install ffmpeg
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y ffmpeg

# Windows
winget install Gyan.FFmpeg
```

### Installation
```bash
# Clone repository
git clone [repository-url]
cd mockup-scroller

# Install dependencies
bun install
```

### Development Commands
```bash
# Run in development mode (TypeScript)
bun run dev --input "./test-input/*.png" --out "./out"

# Build to JavaScript
bun run build

# Run compiled version
bun dist/src/cli.js --input "./test-input/*.png" --out "./out"
```

### Project Scripts
- `bun run dev` - Run TypeScript directly
- `bun run build` - Compile to JavaScript in dist/

## Testing

### Manual Testing Process
1. Place test PNGs in `test-input/` directory
2. Run: `bun run dev --input "./test-input/*.png" --out "./out"`
3. Verify outputs in `out/` directory

### Test Cases to Verify
- **Short content** (< 1334px height) - Should not scroll
- **Tall content** (> 1334px height) - Should scroll smoothly
- **Narrow content** (< 750px width) - Should upscale to fit
- **Wide content** (> 750px width) - Should downscale to fit
- **Invalid formats** - Should reject with clear error
- **Missing ffmpeg** - Should exit with code 3

### Current Test File
- `test-input/rethink-landing-page-aug-28.png` (640×7007px)
- Successfully generates scrolling GIF

## Future Enhancements

### Immediate Opportunities
1. **Multiple Device Support**
   - Add more device types (iPhone 14, iPad, Android)
   - Portrait and landscape orientations
   - Device selection via CLI flag

2. **Performance Optimizations**
   - Parallel processing option
   - GIF compression settings
   - Frame rate customization
   - Cache resized images for batch processing

3. **Enhanced Features**
   - Custom scroll duration
   - Easing functions (ease-in-out, etc.)
   - Pause at top/bottom
   - Status bar overlays
   - Device shadows/reflections

4. **Output Options**
   - MP4/WebM video output
   - Optimized GIF size options
   - Multiple quality presets
   - APNG support

5. **Developer Experience**
   - Config file support (.mockuprc)
   - Watch mode for development
   - Figma API integration
   - Web UI wrapper

### Architecture Considerations for Scaling
- Device configurations should be data-driven (JSON/YAML)
- Consider plugin architecture for device packs
- Abstract encoder interface for multiple output formats
- Add progress indicators for long operations

## Important Design Decisions

### 1. Sequential Processing
**Decision:** Process files one at a time  
**Rationale:** Prevents memory issues with large images/many frames  
**Trade-off:** Slower but more reliable  

### 2. SVG for Bezels
**Decision:** Embed SVG as strings, render to PNG at runtime  
**Rationale:** Flexibility, no binary assets, easy to modify  
**Trade-off:** Small runtime overhead  

### 3. Two-Pass GIF Encoding
**Decision:** Generate palette first, then encode  
**Rationale:** Much better quality and smaller file size  
**Trade-off:** Doubles ffmpeg execution time  

### 4. Frame File Naming
**Decision:** Use zero-padded numeric sequence  
**Rationale:** ffmpeg requires deterministic pattern  
**Format:** `{basename}.{000000-000179}.png`  

### 5. No Parallel Processing (MVP)
**Decision:** Sequential only in MVP  
**Rationale:** Simplicity, predictable resource usage  
**Future:** Add opt-in parallel mode  

## Critical Files to Understand

1. **`MVP_IMPLEMENTATION_PLAN_AUG_28.md`** - The complete specification, acceptance criteria, exact dimensions
2. **`src/animate.ts`** - Core frame generation logic
3. **`src/image.ts`** - All image manipulation functions
4. **`src/bezel/device-meta.ts`** - Device specifications and SVG definitions
5. **`src/encode.ts`** - ffmpeg integration and GIF creation

## Contact and Resources

- Original MVP Plan: `MVP_IMPLEMENTATION_PLAN_AUG_28.md`
- Implementation Status: `IMPLEMENTATION_STATUS.md`
- Sample Input: `test-input/rethink-landing-page-aug-28.png`
- Generated Outputs: `out/` directory

## Handoff Checklist

- [x] All MVP features implemented and tested
- [x] TypeScript compilation working
- [x] ffmpeg integration functional
- [x] Sample input file provided
- [x] Documentation complete
- [x] Known issues documented
- [x] Future enhancements outlined

---

**Note:** This project is MVP-complete and ready for feature expansion. The architecture is designed to easily accommodate multiple devices and output formats. The next logical step would be adding device variety while maintaining the established pipeline architecture.