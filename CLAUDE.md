# CLAUDE.md - AI Assistant Reference Guide

## Project Overview
**Project:** mockup-scroller  
**Version:** 1.0.0  
**Purpose:** CLI tool that transforms static PNG mockups into animated GIFs showing the mockup within an iPhone SE device bezel with smooth scrolling animation.

## Quick Start Commands

### Development
```bash
# Install dependencies
bun install

# Run with TypeScript (development)
bun run dev --input "./mockup.png" --out "./out"
bun run dev --input "./folder-of-pngs" --out "./out" --speed slow

# Build to JavaScript
bun run build

# Run compiled version
bun dist/src/cli.js --input "./mockup.png" --out "./out"
```

### Testing & Validation
```bash
# No automated tests - manual testing required
# Test with sample file
bun run dev --input "./test-input/*.png" --out "./out"

# Verify ffmpeg is installed
ffmpeg -version
```

## Project Structure
```
mockup-scroller/
├── src/
│   ├── cli.ts              # CLI entry point with commander
│   ├── main.ts             # Main orchestration logic
│   ├── fileio.ts           # File operations & validation
│   ├── image.ts            # Image processing with sharp
│   ├── animate.ts          # Frame generation & scrolling
│   ├── encode.ts           # GIF encoding with ffmpeg
│   └── bezel/
│       ├── device-meta.ts  # iPhone SE specs & SVG data
│       └── svg/
│           ├── bezel.svg   # Device frame design
│           └── mask.svg    # Screen corner radius mask
├── dist/                   # Compiled JavaScript output
├── out/                    # Generated GIFs and PNGs
├── package.json            # Dependencies and scripts
└── bun.lock               # Lockfile
```

## Key Technical Details

### Dependencies
- **Runtime:** Bun 1.2.21+
- **Language:** TypeScript 5.5.x
- **External:** ffmpeg (must be installed separately)
- **Main Libraries:**
  - `sharp` - Image processing
  - `commander` - CLI parsing
  - `globby` - File pattern matching
  - `execa` - ffmpeg execution
  - `zod` - Input validation

### Device Specifications (iPhone SE)
- Canvas Size: 900×1800px
- Viewport: 750×1334px at (75, 210)
- Screen Corner Radius: 48px
- Output: 80% scaled GIF (720px width)
- Animation: 30 FPS, adaptive duration

### CLI Arguments
- `--input` / `-i`: Input PNG file(s) or directory
- `--out` / `-o`: Output directory for GIF/PNG
- `--speed` / `-s`: Scroll speed (slow/normal/fast)

### Speed Configuration (animate.ts)
```typescript
slow:   15px/frame, 180-360 frames (6-12s)
normal: 21.5px/frame, 150-270 frames (5-9s)  
fast:   30px/frame, 90-180 frames (3-6s)
```

## Important Implementation Notes

### File Processing Flow
1. **Input Validation** (fileio.ts) - Check PNG format, dimensions
2. **Resize** (image.ts) - Scale to 750px width
3. **Frame Generation** (animate.ts) - Create scrolling frames
4. **GIF Encoding** (encode.ts) - Two-pass ffmpeg with palette
5. **Output** - GIF animation + static PNG preview

### Key Functions & Locations

**CLI Entry** - src/cli.ts:34
```typescript
program
  .option('-i, --input <path>', 'Input PNG files or directory')
  .option('-o, --out <path>', 'Output directory')
  .option('-s, --speed <speed>', 'Scroll speed', 'normal')
```

**Main Processing** - src/main.ts:18
```typescript
processFile(inputPath, outputDir, options)
```

**Frame Generation** - src/animate.ts:84
```typescript
generateFrames(inputPath, outputDir, device, options)
```

**GIF Creation** - src/encode.ts:9
```typescript
createGif(framePaths, outputPath, device)
```

### Error Handling & Exit Codes
- `0` - Success
- `2` - Validation error (bad args, no PNGs)
- `3` - Environment error (ffmpeg missing)
- `4` - Processing error (continues batch)

### Input Constraints
- Format: PNG only (validated by magic bytes)
- Min dimensions: 300×500px
- Max height: 20,000px
- File size: > 1KB

### Output Files
For input `mockup.png`:
- `mockup.framed.scroll.gif` - Animated scrolling GIF
- `mockup.framed.static.png` - Static first frame

## Common Tasks & Solutions

### Adding New Device Types
Currently only supports iPhone SE. To add new devices:
1. Update `src/bezel/device-meta.ts` with new device specs
2. Create new SVG files in `src/bezel/svg/`
3. Add device selection logic to CLI

### Modifying Animation Speed
Edit `SPEED_CONFIG` in `src/animate.ts:10-30`

### Changing Output Quality
- GIF scaling: `src/encode.ts:42` (currently 80%)
- PNG compression: `src/image.ts:94` (level 6)
- Frame rate: `src/encode.ts:36` (30 FPS)

### Batch Processing
```bash
# Process entire directory
bun run dev --input "./screenshots" --out "./out"

# With glob pattern
bun run dev --input "./designs/*.png" --out "./out"
```

## Known Issues & Limitations

1. **Single Device Only** - iPhone SE portrait only
2. **Large File Sizes** - GIFs can be 30-40MB for tall mockups
3. **Sequential Processing** - No parallel processing (by design)
4. **No Content Detection** - Preserves all PNG content including padding
5. **ffmpeg Required** - Must be installed separately

## Development Workflow

### Making Changes
1. Edit TypeScript files in `src/`
2. Test with: `bun run dev --input "./test.png" --out "./out"`
3. Build: `bun run build`
4. Test compiled: `bun dist/src/cli.js --input "./test.png" --out "./out"`

### File Modifications Tracker
The file `src/animate.ts` has been modified (git status shows it)

### Testing Checklist
- [ ] Short content (<1334px) - Should not scroll
- [ ] Tall content (>1334px) - Should scroll smoothly  
- [ ] Speed variations - Test slow/normal/fast
- [ ] Batch processing - Multiple files
- [ ] Invalid input - Should show clear errors
- [ ] Missing ffmpeg - Exit code 3

## Future Enhancement Opportunities

### High Priority
- Multiple device support (iPhone 14, iPad, Android)
- Landscape orientation support
- MP4/WebM video output
- Parallel processing option

### Nice to Have
- Config file support (.mockuprc)
- Figma API integration
- Custom pause durations
- Easing functions for scroll
- Web UI wrapper

## Critical Files Reference

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/cli.ts` | CLI interface | Argument parsing, validation |
| `src/main.ts` | Orchestration | `processFile()` main logic |
| `src/animate.ts` | Animation | `generateFrames()`, speed config |
| `src/image.ts` | Image ops | `resizeToViewport()`, `renderFrame()` |
| `src/encode.ts` | GIF creation | `createGif()` ffmpeg integration |
| `src/bezel/device-meta.ts` | Device specs | SVG data, dimensions |

## Debugging Tips

### Common Issues
1. **"ffmpeg not found"** - Install ffmpeg: `brew install ffmpeg`
2. **Large GIF files** - Normal for tall mockups, already optimized to 80% scale
3. **Slow processing** - Expected ~50-60s for 270 frames
4. **Memory issues** - Files processed sequentially to prevent this

### Useful Debug Commands
```bash
# Check ffmpeg version
ffmpeg -version

# List generated frames
ls -la out/*.*.png | head -20

# Check output file sizes
du -h out/*.gif

# Monitor memory during processing
watch -n 1 'ps aux | grep bun'
```

## Contact & Resources

- Repository: https://github.com/adpharm/mockup-scroller
- Original Plan: `MVP_IMPLEMENTATION_PLAN_AUG_28.md`
- Dev Handoff: `DEVELOPER_HANDOFF.md`
- Status: `IMPLEMENTATION_STATUS.md`

## Quick Reference Summary

**Run:** `bun run dev -i "./input.png" -o "./out" -s normal`  
**Build:** `bun run build`  
**Test:** Use sample in `test-input/`  
**Output:** Creates `.gif` and `.png` in output directory  
**Speed:** slow/normal/fast  
**Device:** iPhone SE portrait only (for now)  
**Requirements:** Bun + ffmpeg installed