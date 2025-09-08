# Changelog

All notable changes to mockup-scroller will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses commit-based versioning (no traditional tags).

## [2025-09-08]

### Added
- **CDN Upload Feature** - Upload generated files to S3/Bunny CDN with `--upload` flag
  - Automatic upload to S3 bucket (`mockup-scroller-cdn-outputs`)
  - Files organized by input filename in S3
  - Files accessible via CDN URL: `https://mockup-cdn.adpharm.digital/[folder]/[file]`
  - Uses AWS SSO credentials with `pharmer` profile
  - Blocks on upload failures to ensure reliability
  - Console output shows CDN URLs after successful upload

## [2025-09-05]

### Changed
- **3f7c9d1** - Simplify to screen segments only with transparent background
  - Removed bezel from screen segments
  - Added transparent background support for cleaner exports

### Added
- **0ee0b14** - Add simple test scripts for local/rethink-aug28 folder
  - Created test scripts for easier development testing

### Documentation
- **2721172** - Update CLAUDE.md with comprehensive dev guide and clean up repo
  - Complete rewrite of developer documentation
  - Removed outdated files and empty directories
  - Added clear programming conventions and owner preferences

### Changed
- **132207d** - Replace linear scrolling with smooth human-like scroll animation
  - Implemented natural burst-and-pause scrolling pattern
  - Removed speed configuration in favor of optimized defaults
  - Added smooth ease-in-out cubic easing function

## [2025-09-04]

### Added
- **9f985d5** - Add multi-screen export feature with bezel-less segments
  - Generate both framed segments (with bezel) and screen segments (without bezel)
  - Configurable screen segment height via `--screen-height` flag
  - Smart overlap handling to avoid trivial final segments

## [2025-08-28]

### Documentation
- **26ae905** - Update DEVELOPER_HANDOFF.md to v1.0.0 with all recent features
  - Documented v1.0.0 feature set
  - Added comprehensive developer handoff notes

### Added
- **2250d52** - Add folder batch processing with improved progress reporting
  - Process entire directories of mockups
  - Clear progress indicators for batch operations
  - Support for glob patterns

### Changed
- **ffaccd1** - Upgrade to enhanced iPhone SE bezel design
  - Improved bezel graphics with more realistic appearance
  - Better rounded corner masking

### Added
- **295ba53** - Add configurable scroll speed and prepare for open source
  - Initial speed configuration support (later removed in favor of human-like scrolling)
  - Repository preparation for open source release

### Initial Release
- **5760a88** - First commit
  - Initial implementation of mockup-scroller
  - Basic PNG to GIF conversion with iPhone SE bezels
  - Linear scrolling animation

## Features Overview

### Current Version Features
- Transform static PNG mockups into animated GIFs
- Human-like scrolling with natural burst-and-pause patterns
- iPhone SE device bezels (900×1800px canvas, 750×1334px viewport)
- Multi-screen segment export (framed and bezel-less)
- Batch processing for multiple files
- Configurable screen segment heights
- Smart content overlap handling

### Removed Features
- `--speed` flag (replaced with optimized human-like defaults)
- `.framed.static.png` files (replaced with `.framed.1.png`)
- Linear scrolling animation (replaced with human-like scrolling)

## Usage

```bash
# Basic usage
bun run dev --input "./mockup.png" --out "./out"

# Batch processing
bun run dev --input "./folder/" --out "./out"

# Custom screen segment height
bun run dev --input "./mockup.png" --out "./out" --screen-height 2000

# No segments (GIF only)
bun run dev --input "./mockup.png" --out "./out" --no-segments

# Upload to CDN
bun run dev --input "./mockup.png" --out "./out" --upload
```