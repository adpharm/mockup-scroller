# CLAUDE.md - Comprehensive Development Guide

## Project Overview
**Project:** mockup-scroller  
**Version:** 1.0.0  
**Purpose:** CLI tool that transforms static PNG mockups into animated GIFs with iPhone SE device bezels and human-like scrolling animation.

## Changelog
For a complete history of changes and updates, see [CHANGELOG.md](./CHANGELOG.md).

## Recent Major Changes (IMPORTANT!)
1. **Human-like scrolling** - Replaced linear scrolling with natural burst-and-pause pattern
2. **No more speed options** - Removed `--speed` flag, uses optimized defaults
3. **Multi-screen segments** - Generates both framed and bezel-less segments
4. **No static PNGs** - Replaced `.framed.static.png` with `.framed.1.png`

## Quick Start Commands

### Development
```bash
# Install dependencies
bun install

# Basic usage (NO --speed flag anymore!)
bun run dev --input "./mockup.png" --out "./out"
bun run dev --input "./folder/" --out "./out"

# With options
bun run dev --input "./mockup.png" --out "./out" --no-segments
bun run dev --input "./mockup.png" --out "./out" --screen-height 2000

# Build to JavaScript
bun run build

# Run compiled version
bun dist/src/cli.js --input "./mockup.png" --out "./out"
```

## Output Structure (NEW!)

For input `mockup.png`, generates:
- `mockup.framed.scroll.gif` - Animated GIF with human-like scrolling
- `mockup.framed.1.png` - First framed segment (with bezel)
- `mockup.framed.2.png` - Second framed segment (etc.)
- `mockup.screen.1.png` - First screen segment (NO bezel, square corners)
- `mockup.screen.2.png` - Second screen segment (etc.)

**NO MORE** `.framed.static.png` files!

## Project Structure
```
mockup-scroller/
├── src/
│   ├── cli.ts              # CLI entry point (NO speed parsing!)
│   ├── main.ts             # Main orchestration 
│   ├── fileio.ts           # File operations & validation
│   ├── image.ts            # Image processing + cropSimple (NEW!)
│   ├── animate.ts          # HUMAN SCROLLING + segments generation
│   ├── encode.ts           # GIF encoding (no writeStaticPreview!)
│   └── bezel/
│       ├── device-meta.ts  # iPhone SE specs & SVG data
│       └── svg/
│           ├── bezel.svg   # Device frame design
│           └── mask.svg    # Screen corner radius mask
├── dist/                   # Compiled JavaScript output
├── out/                    # Generated GIFs and PNGs
├── package.json            # Dependencies and scripts
└── CLAUDE.md              # THIS FILE - Always check first!
```

## Programming Style & Conventions

### Owner's Preferences
1. **NO backwards compatibility** - Clean breaks are fine, remove old code
2. **NO emojis in code** - Unless explicitly requested
3. **Simplicity over configuration** - Remove options when one good default exists
4. **Human-friendly defaults** - Make the tool work well out of the box
5. **Clean commits** - No co-author tags unless requested

### Code Style
- **TypeScript** - Strict types, interfaces for complex objects
- **Async/await** - Always use over callbacks
- **Early returns** - Guard clauses at function start
- **Descriptive names** - `generateScreenSegments` not `genScreenSegs`
- **Constants at top** - Configuration should be easily findable
- **No console.log spam** - Clean, informative output only

### Error Handling
```typescript
// Use specific exit codes
// 0 = success
// 2 = validation error
// 3 = environment error (missing deps)
// 4 = processing error
```

## Human-like Scrolling (CRITICAL FEATURE)

Located in `src/animate.ts`, uses configurable burst pattern:

```typescript
// EASILY TUNABLE - Adjust these for different scroll feel
const SWIPE_PATTERN: SwipeConfig[] = [
  { distanceFactor: 0.50, swipeFrames: 15, pauseFrames: 15 },
  { distanceFactor: 0.48, swipeFrames: 14, pauseFrames: 16 },
  { distanceFactor: 0.52, swipeFrames: 16, pauseFrames: 14 },
  { distanceFactor: 0.45, swipeFrames: 13, pauseFrames: 17 },
  { distanceFactor: 0.53, swipeFrames: 17, pauseFrames: 15 },
];

// Uses smooth ease-in-out cubic for natural motion
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

**Key characteristics:**
- Swipes: 45-53% of viewport per burst
- Duration: 0.4-0.6s per swipe (13-17 frames)
- Pauses: 0.47-0.57s between swipes
- Easing: Smooth acceleration AND deceleration

## Multi-Screen Segments Feature

### Two Types Generated
1. **Framed segments** (`.framed.N.png`)
   - Include iPhone SE bezel
   - Height: 1334px (viewport height)
   - Rounded corners (48px radius)
   
2. **Screen segments** (`.screen.N.png`)
   - NO bezel, just content
   - Height: Configurable (default 1600px)
   - Square corners
   - White background for padding

### Segment Logic (src/animate.ts)
```typescript
// 100px overlap between segments
const OVERLAP = 100;

// Skip last segment if <20% new content
const TRIVIAL_THRESHOLD = 0.2;
```

### CLI Options
- `--no-segments` - Disable segment generation
- `--screen-height <pixels>` - Screen segment height (default: 1600)

## Key Functions & Their Purposes

### Main Processing Pipeline

**src/main.ts - processOne()**
- Validates input PNG
- Generates both segment types
- Creates animated GIF
- Handles all error cases

**src/animate.ts - computeHumanScrollOffsets()**
- Generates natural scrolling pattern
- Returns array of Y positions for each frame
- Handles pause frames at start/end

**src/animate.ts - generateSegments()**
- Creates framed segments with bezel
- Uses rounded corner mask

**src/animate.ts - generateScreenSegments()**
- Creates bezel-less segments
- Configurable height
- No masking, square corners

**src/image.ts - cropSimple()**
- For screen segments (no mask)
- Handles padding with white background

**src/image.ts - cropFrame()**
- For framed segments
- Applies rounded corner mask
- Handles partial content at end

## Common Tasks

### Adjusting Scroll Feel
Edit `SWIPE_PATTERN` in `src/animate.ts`:
```typescript
// Make scrolling slower/smoother
{ distanceFactor: 0.40, swipeFrames: 20, pauseFrames: 20 }

// Make it snappier
{ distanceFactor: 0.60, swipeFrames: 10, pauseFrames: 10 }
```

### Changing Screen Segment Height
```bash
# Default 1600px
bun run dev --input "./mockup.png" --out "./out"

# Custom height
bun run dev --input "./mockup.png" --out "./out" --screen-height 2000
```

### Processing Multiple Files
```bash
# Entire directory
bun run dev --input "./screenshots/" --out "./out"

# Glob pattern
bun run dev --input "./designs/*.png" --out "./out"
```

### Disable Segments (GIF only)
```bash
bun run dev --input "./mockup.png" --out "./out" --no-segments
```

## Troubleshooting

### Issue: GIF looks jerky
**Solution:** Adjust `SWIPE_PATTERN` in `src/animate.ts` - increase `swipeFrames` for smoother motion

### Issue: Scrolling too fast/slow
**Solution:** Modify `distanceFactor` in `SWIPE_PATTERN` - lower = smaller jumps

### Issue: "Expected integer for top but received..."
**Cause:** Floating point rounding in scroll calculations
**Solution:** Ensure all position calculations use `Math.round()`

### Issue: Extract area error
**Cause:** Trying to crop beyond image bounds
**Solution:** Check `cropFrame()` and `cropSimple()` properly handle content height

### Issue: Old .static.png files
**Note:** These are deprecated! Delete them, use `.framed.1.png` instead

## Testing Checklist

- [ ] **Short content** (<1334px) - Should generate 1 segment, no scroll
- [ ] **Medium content** (~3000px) - Multiple segments, smooth scroll
- [ ] **Tall content** (>5000px) - Many segments, longer animation
- [ ] **Batch processing** - Multiple files in directory
- [ ] **--no-segments flag** - Only generates GIF
- [ ] **--screen-height** - Custom segment heights work
- [ ] **Invalid input** - Clear error messages
- [ ] **Missing ffmpeg** - Exit code 3 with helpful message

## File Constraints

### Input Requirements
- Format: PNG only (validates magic bytes)
- Min dimensions: 300×500px
- Max height: 20,000px
- Min file size: 1KB

### Output Specifications
- GIF: 80% scaled (720px width), 30 FPS
- Framed segments: 900×1800px canvas, 750×1334px viewport
- Screen segments: 750×[configurable]px, no canvas

## Dependencies & Environment

### Required
- **Bun:** 1.2.21+
- **ffmpeg:** System-installed (check with `ffmpeg -version`)
- **Node modules:** Run `bun install`

### Main Libraries
- `sharp` - All image processing
- `commander` - CLI argument parsing
- `globby` - File pattern matching
- `execa` - ffmpeg subprocess execution
- `zod` - Input validation

## Infrastructure Management

### Terraform/Terragrunt Rules
**CRITICAL: Never run `terragrunt apply` or `terraform apply` automatically. Only run `plan` commands and inform the user when they should apply changes.**

## Git Workflow

### Making Changes
1. Edit TypeScript files in `src/`
2. Test: `bun run dev --input "./test.png" --out "./out"`
3. Build: `bun run build`
4. Verify: Check output files manually
5. Commit: Clear message, no co-author

### When Committing Changes
When asked to add and commit changes, I should:
1. Review the changes being committed
2. Determine if they're significant enough for the changelog
3. If yes, update CHANGELOG.md with the new entry before committing
4. Include changelog update in the same commit if applicable
5. Use clear, descriptive commit messages

Changelog-worthy changes include:
- New features or functionality
- Breaking changes or removals
- Significant bug fixes
- Major refactoring
- Documentation updates
- Configuration changes

Skip changelog for:
- Minor typo fixes
- Code formatting only
- Internal refactoring with no user impact
- Development-only changes

### Commit Style
```bash
# Good
git commit -m "Add feature X with Y behavior"

# Bad
git commit -m "Updated files"

# Never (unless requested)
git commit -m "Feature X

Co-authored-by: ..."
```

## Owner Preferences Summary

1. **Remove rather than deprecate** - No backwards compatibility baggage
2. **One good default > many options** - Removed speed flags
3. **Human-like > mechanical** - Natural scrolling patterns
4. **Clean output** - Minimal console messages
5. **Straightforward code** - No clever tricks, readable is better

## Quick Command Reference

```bash
# Standard usage (most common)
bun run dev --input "./mockup.png" --out "./out"

# Directory of files
bun run dev --input "./screenshots/" --out "./out"

# No segments (GIF only)
bun run dev --input "./mockup.png" --out "./out" --no-segments

# Taller screen segments
bun run dev --input "./mockup.png" --out "./out" --screen-height 2000

# Build for production
bun run build

# Run production build
bun dist/src/cli.js --input "./mockup.png" --out "./out"
```

## CRITICAL: What Changed Recently

1. **NO MORE --speed flag** - Removed completely
2. **Human scrolling is default** - Burst-and-pause pattern
3. **Two segment types** - Framed AND screen segments
4. **No .static.png files** - Use .framed.1.png
5. **Cleaned repo** - Removed old docs and empty dirs

## Need Help?

1. Check this file first - it's the source of truth
2. Review [CHANGELOG.md](./CHANGELOG.md) for version history
3. Look at recent commits for context
4. Test with sample files in `local/` directory
5. File issues at: https://github.com/adpharm/mockup-scroller/issues

---
**Last Updated:** After implementing human-like scrolling and multi-screen segments
**Maintainer Note:** Keep this file current with ANY changes to behavior or API!