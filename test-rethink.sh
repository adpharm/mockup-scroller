#!/bin/bash

# Process all PNGs in local/rethink-aug28 folder
# Generates: GIF animations + screen segments (2400px height)

bun run dev --input "./local/rethink-aug28" --out "./out/rethink-sep5" --screen-height 2400