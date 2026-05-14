# Rovvy Brand Guide for Developers

## Logo Usage

Always import from the logo component:
```tsx
import { RovvyLogo, RovvyIcon } from '@/components/RovvyLogo'
```

### Full Logo (name + symbol)
```tsx
// On dark backgrounds (sidebar, login panel)
<RovvyLogo variant="dark" size="md" />

// On light backgrounds (cards, white pages)
<RovvyLogo variant="primary" size="md" />

// With tagline (landing page, hero sections)
<RovvyLogo variant="dark" size="lg" showTagline={true} />
```

### Icon Only (r symbol)
```tsx
// Mobile header, favicon, small spaces
<RovvyIcon size={32} />

// Large app icon
<RovvyIcon size={64} />
```

## Brand Colors
Import from brand constants:
```tsx
import { BRAND } from '@/lib/brand'
```

## Rules
- NEVER hardcode "Rovvy" text as plain HTML
- NEVER use <img> tags for the logo
- ALWAYS use RovvyLogo or RovvyIcon components
- ALWAYS use BRAND.colors for brand colors
- When building new pages: add RovvyLogo to 
  the page header if it needs one
