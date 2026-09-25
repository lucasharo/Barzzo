# Common Rules for Professional UI + Pre-Delivery Checklist

## Icons & Visual Elements

| Rule | Standard | Avoid | Why It Matters |
|------|----------|--------|----------------|
| **No Emoji as Structural Icons** | Use vector-based icons (e.g., Lucide). | Using emojis for navigation, settings, or system controls. | Emojis are font-dependent and cannot be controlled via design tokens. |
| **Vector-Only Assets** | Use SVG or platform vector icons that scale cleanly. | Raster PNG icons that blur or pixelate. | Ensures scalability and dark/light mode adaptability. |
| **Consistent Icon Sizing** | Define icon sizes as design tokens (sm: 16px, md: 24px, lg: 32px). | Mixing arbitrary values randomly. | Maintains rhythm and visual hierarchy. |
| **Touch Target Minimum** | Use at least 44x44px; expand hit area if visual icon is smaller. | Small icons without expanded tap area. | Touch-friendly and accessible. |
| **Icon Contrast** | Meaningful icons need at least 3:1 against adjacent colors. | Low-contrast icons that carry meaning or state. | Accessibility compliance. |

## Interaction & Mobile Polish

| Rule | Do | Don't |
|------|----|----- |
| **Tap feedback** | Provide clear pressed feedback within 80-150ms | No visual response on tap |
| **Touch target minimum** | Keep tap areas >= 44x44px | Tiny tap targets |
| **Disabled state clarity** | Use disabled semantics, reduced emphasis | Controls that look tappable but do nothing |
| **Safe areas** | Respect notch and safe areas on mobile | Content clipped by notch or navigation bar |
