export interface DeviceMeta {
  canvas: { width: number; height: number };
  viewport: { x: number; y: number; width: number; height: number };
  screenCornerRadius: number;
  backgroundColor: string;
}

export const IPHONE_SE_PORTRAIT: DeviceMeta = {
  canvas: { width: 1000, height: 2000 },
  viewport: { x: 125, y: 333, width: 750, height: 1334 },
  screenCornerRadius: 40,
  backgroundColor: "#0B0F13",
};

const BEZEL_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1000" height="2000" viewBox="0 0 1000 2000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Define a mask that cuts out the screen area -->
    <mask id="screenCutout">
      <!-- White = visible, Black = transparent -->
      <rect x="0" y="0" width="1000" height="2000" fill="white"/>
      <!-- Cut out the screen area (125, 333, 750, 1334) with 40px radius -->
      <rect x="125" y="333" width="750" height="1334" rx="40" ry="40" fill="black"/>
    </mask>
  </defs>
  
  <!-- Device body with screen cutout -->
  <rect x="50" y="30" width="900" height="1940" rx="100" ry="100" fill="#0D0F12" mask="url(#screenCutout)"/>
  
  <!-- Outer glass border (subtle stroke) -->
  <rect x="70" y="50" width="860" height="1900" rx="90" ry="90" fill="none" stroke="#1A1E25" stroke-width="4"/>
  
  <!-- Inner screen border (subtle) -->
  <rect x="125" y="333" width="750" height="1334" rx="40" ry="40" fill="none" stroke="#1A1E25" stroke-width="2" opacity="0.5"/>
</svg>`;

const MASK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="750" height="1334" viewBox="0 0 750 1334" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="750" height="1334" rx="40" ry="40" fill="#ffffff"/>
</svg>`;

export function bezelSvgBuffer(): Buffer {
  return Buffer.from(BEZEL_SVG);
}

export function maskSvgBuffer(): Buffer {
  return Buffer.from(MASK_SVG);
}