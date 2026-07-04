---
name: TarGame
colors:
  surface: '#0d1516'
  surface-dim: '#0d1516'
  surface-bright: '#333a3c'
  surface-container-lowest: '#080f11'
  surface-container-low: '#151d1e'
  surface-container: '#192122'
  surface-container-high: '#242b2d'
  surface-container-highest: '#2e3638'
  on-surface: '#dce4e5'
  on-surface-variant: '#bac9cc'
  inverse-surface: '#dce4e5'
  inverse-on-surface: '#2a3233'
  outline: '#849396'
  outline-variant: '#3b494c'
  surface-tint: '#00daf3'
  primary: '#c3f5ff'
  on-primary: '#00363d'
  primary-container: '#00e5ff'
  on-primary-container: '#00626e'
  inverse-primary: '#006875'
  secondary: '#ffb1c3'
  on-secondary: '#66002c'
  secondary-container: '#ff4b89'
  on-secondary-container: '#590026'
  tertiary: '#ffeac0'
  on-tertiary: '#3e2e00'
  tertiary-container: '#fec931'
  on-tertiary-container: '#6f5500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cf0ff'
  primary-fixed-dim: '#00daf3'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#ffd9e0'
  secondary-fixed-dim: '#ffb1c3'
  on-secondary-fixed: '#3f0019'
  on-secondary-fixed-variant: '#8f0041'
  tertiary-fixed: '#ffdf96'
  tertiary-fixed-dim: '#f3bf26'
  on-tertiary-fixed: '#251a00'
  on-tertiary-fixed-variant: '#594400'
  background: '#0d1516'
  on-background: '#dce4e5'
  surface-variant: '#2e3638'
  background-dark: '#0A0A12'
  surface-glass: rgba(255, 255, 255, 0.03)
  surface-hover: rgba(255, 255, 255, 0.06)
  border-glass: rgba(255, 255, 255, 0.08)
  text-main: '#F3F4F6'
  text-muted: '#8B949E'
  status-success: '#22C55E'
  status-warning: '#EAB308'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  body-sm:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  label-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.0'
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1.0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-padding: 1.5rem
  element-gap: 1.5rem
  component-padding: 1rem
  tight-gap: 0.75rem
  inner-padding: 0.5rem
---

## Brand & Style
TarGame is a high-performance gaming aesthetic designed for competitive focus and immersive social interaction. The brand personality is technical, futuristic, and premium, utilizing a "Dark Mode First" philosophy. 

The design style is a sophisticated evolution of **Glassmorphism**, characterized by deep dark glass surfaces, ultra-fine borders, and vibrant neon accents. It avoids heavy skewmorphism in favor of light-based depth, using glow effects and backdrop blurs to simulate a multi-layered holographic interface floating in a dark environment.

## Colors
The palette is rooted in an ultra-dark navy-black (`#0A0A12`) to maximize the perceived luminance of neon elements. 

- **Primary (Electric Cyan):** Used for active states, primary actions, and "online" indicators. It represents energy and connectivity.
- **Secondary (Vivid Magenta):** Reserved for destructive actions (Leave Room) or high-impact decorative ambient glows.
- **Surface Strategy:** Instead of solid grays, surfaces use varying opacities of white over the dark background combined with `backdrop-filter: blur(24px)`.
- **Text:** High-contrast off-white for readability, with a muted slate-gray for metadata and secondary information.

## Typography
The system uses a dual-font pairing to balance technical precision with approachable readability.

- **Space Grotesk (Display/Labels):** Chosen for its geometric, tech-focused character. Use this for all headlines, buttons, and system labels where a "mechanical" feel is desired.
- **Outfit (Body):** A softer geometric sans-serif used for chat messages and long-form content to ensure high legibility and a premium feel during extended reading sessions.
- **Scaling:** Mobile font sizes should maintain the same weight but decrease the `headline-xl` to `20px` to fit tighter viewports.

## Layout & Spacing
The layout follows a **Fluid Content Grid** with fixed sidebars for utility. 

- **Desktop:** A three-section layout (Navigation Header, Main Content, Sidebar). Main content areas use a 24px (1.5rem) rhythm for external margins and internal gaps.
- **Chat Feed:** Uses a vertical stack with 24px spacing between message groups to provide clear visual separation between speakers.
- **Mobile Adaptive:** On mobile, the Sidebar (Roster) collapses into a bottom sheet or a toggleable drawer. Main container padding reduces to 16px (1rem).

## Elevation & Depth
Depth is created through transparency and light, not shadows.

1.  **Level 0 (Base):** The `background-dark` color with large, soft ambient blurs of Primary/Secondary colors at low (5%) opacity.
2.  **Level 1 (Panels):** Glass surfaces using 3% white fill, 24px backdrop blur, and an 8% white border.
3.  **Level 2 (Active/Floating):** Surfaces that are being interacted with use a 6% white fill.
4.  **Glows:** High-priority elements (Ready button, Active Mic) use the `Primary` color with a 20px-30px outer glow (box-shadow with spread and low opacity) to simulate light emission.

## Shapes
The system uses a "Varied Radius" approach to define hierarchy:

- **Standard Containers:** 12px (md) for cards and main chat panels.
- **Small Elements:** 8px (sm) for input fields and small buttons.
- **Action Buttons:** 24px (lg) for high-level navigation or major CTAs to make them feel more distinct from the grid-based layout.
- **Avatars/Indicators:** Always 100% (full) circle to provide organic contrast against the sharp, rectangular layout of the glass panels.

## Components

### Buttons
- **Primary:** Outline in `primary`, font in `primary`. On hover/active, fills with `primary` and switches text to `background-dark`. Includes a "glow" shadow.
- **Ghost/Icon:** Glass surface with subtle border. Hover state increases opacity to 6% white.
- **Destructive:** 10% `secondary` color fill with 20% `secondary` border.

### Chat Bubbles
- **Incoming:** Glass surface (3% white) with default glass border.
- **Outgoing:** 10% `primary` color fill with 20% `primary` border to differentiate from others.
- **Shapes:** Asymmetric rounding (12px on three corners, 0px on the corner nearest the avatar).

### Inputs
- **Text Input:** Glass surface with an "inner shadow" to suggest depth. Focused state adds a `primary` border and 50% opacity primary ring.

### Player Cards / Lists
- Use a 2-column layout for player cards (Avatar | Name + Status).
- **Active State:** Add a 2px `primary` ring around the avatar and a subtle pulse animation for the "Speaking" state.

### Scrollbars
- Custom hidden or ultra-thin (6px) scrollbars with `text-muted` thumbs to avoid cluttering the glass interface.