# Rovvy Brand Guide for Developers

## Official Logo Assets

Source of truth: **`/brand/`** at repo root.

| File | Usage |
|------|--------|
| `rovvy_logo_primary.png` | Light backgrounds (headers, white pages) |
| `rovvy_logo_dark.png` | Dark backgrounds (login panels, navy sections) |
| `rovvy_icon.png` | Favicon, small spaces, loading states |

Frontend copies are served from **`frontend/public/brand/`**. When brand assets change, copy from `/brand/` to `/public/brand/`.

## Logo Usage

Always import from the logo component:

```tsx
import { RovvyLogo, RovvyIcon } from '@/components/RovvyLogo'
```

### Full Logo (wordmark)

```tsx
// Light backgrounds (headers, cards, white pages)
<RovvyLogo variant="primary" size="md" />

// Dark backgrounds (login panel, navy hero)
<RovvyLogo variant="dark" size="md" />

// With tagline (landing page, hero sections)
<RovvyLogo variant="dark" size="lg" showTagline={true} />
```

### Icon Only

```tsx
<RovvyIcon size={32} />
```

## Brand Colors

```tsx
import { BRAND } from '@/lib/brand'
```

## Rules

- **NEVER** generate, AI-create, or invent logos
- **NEVER** use inline SVG or code-drawn logos
- **NEVER** add logo files without explicit user confirmation
- **ALWAYS** use `RovvyLogo` or `RovvyIcon` — they load official PNGs only
- **NEVER** hardcode "Travello" — always "Rovvy"
- Use `variant="primary"` on light backgrounds; `variant="dark"` or `"white"` on dark backgrounds
- Do not swap between icon and wordmark in the same header — use one consistent wordmark size

See also: `/brand/rovvy_brand_guide.md` for full brand guidelines.
