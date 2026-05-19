# ClickAsk Design System

## Direction

ClickAsk uses a warm, paper-like interface for calm AI-assisted writing workflows. The interface should feel trustworthy, quiet, and low-friction rather than technical or chrome-heavy.

The visual language is:

- Warm paper surfaces.
- Low-saturation brown text.
- Terracotta accent for focus, selection, and active states.
- Soft borders and restrained elevation.
- Input-first layouts.
- Small, clear utility controls.

## Product Fit

ClickAsk helps users point at page content and turn plain-language questions into structured AI prompts. The UI should make the user feel they are writing a better question, not operating a developer inspector.

Use this direction for:

- Bookmarklet install page.
- Injected floating panel.
- Selection overlays.
- Prompt controls.
- Future prompt preview/history surfaces.

Avoid:

- Dark IDE styling.
- Neon AI gradients.
- Heavy glassmorphism.
- Dense DevTools-like panels.
- Decorative orbs or loud visual effects.

## Colors

### Core Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ca-bg` | `#F6F1E8` | Install page background |
| `--ca-bg-deep` | `#EEE6DA` | Page lower background |
| `--ca-surface` | `#FBF7EF` | Floating panel surface |
| `--ca-surface-raised` | `#FFFDF8` | Inputs, controls |
| `--ca-surface-soft` | `#FFFAF2` | Chips, subtle cards |
| `--ca-text` | `#2B2118` | Primary text |
| `--ca-text-muted` | `#665B50` | Body text |
| `--ca-text-subtle` | `#8A7D6F` | Hints and metadata |
| `--ca-accent` | `#C96442` | Active state, status dot |
| `--ca-accent-strong` | `#B85F43` | Focus ring, selected border |
| `--ca-border` | `#E1D7CA` | Controls |
| `--ca-border-strong` | `rgba(92, 70, 48, 0.16)` | Panels/cards |
| `--ca-button` | `#2B2118` | Primary button |
| `--ca-button-hover` | `#3B2C20` | Primary button hover |
| `--ca-success` | `#B85F43` | Copy success |

### Usage Rules

- Use terracotta only for focus, selection, active state, and primary attention.
- Do not make the whole page orange or brown; keep surfaces light and quiet.
- Text contrast must remain readable on warm paper backgrounds.
- Disabled controls use muted warm gray, not low-opacity black.

## Typography

### Install Page

- Display heading: Georgia, `"Times New Roman"`, serif.
- Body/UI: system sans stack.
- Heading weight: 500.
- Body weight: 400.
- Labels and controls: 650-750.
- Letter spacing: 0 except small uppercase metadata may use `0.08em`.

### Injected Tool UI

- Use system sans only.
- Keep panel text compact but readable.
- Use 11-13px for utility UI, 14px minimum where text input is central.
- Future prompt preview/code fields may use system monospace.

## Layout

### Install Page

- Single-purpose first viewport.
- Content width: about 920px.
- Generous top/bottom padding.
- Hero content should be left-aligned and clear.
- Three-step cards sit below CTA and should remain visible as supporting content.
- On mobile, collapse cards to one column and reduce hero scale.

### Floating Panel

- Default position: bottom right.
- Width: 360px desktop.
- Mobile width: `calc(100vw - 20px)`, with 10px side margins.
- Layout order:
  1. Status/action header.
  2. Selected element chips.
  3. Plain-language input.
  4. Prompt type + copy action.
  5. Recommendation hint.
  6. Shortcut hint.

The input area is the main task surface. The panel should feel like a compact writing tool, not a settings dialog.

## Components

### Buttons

- Primary buttons use dark brown background and warm paper text.
- Hover darkens slightly.
- Disabled state uses warm muted surface with muted text.
- Focus state must be visible with terracotta ring.
- Minimum target height: 36px in panel, 48px for install CTA.

### Inputs And Selects

- Surface: `#FFFDF8`.
- Border: `#E1D7CA`.
- Focus border: `#B85F43`.
- Focus ring: `rgba(184, 95, 67, 0.12)`.
- Border radius: 8px.
- Placeholder should be muted but readable.

### Chips

- Soft warm surface.
- Thin warm border.
- Small remove control with visible hover and accessible name.
- Text should ellipsize instead of resizing layout.

### Selection Overlays

- Hover: terracotta outline with very light fill.
- Selected: stronger terracotta border, subtle fill, light elevation.
- Label: dark brown pill with warm text.
- Marquee: dashed terracotta border with subtle fill.

### Floating Panel Motion

- Enter with a short bottom-right rise and fade.
- Duration: 160-200ms.
- Easing: `cubic-bezier(0.2, 0, 0.1, 1)`.
- Respect `prefers-reduced-motion`.

## States

### Status

- Default status text: `Ready` / `就绪`.
- Paused status: `Paused` / `已暂停`.
- Do not use `Selecting` / `选择中`; it implies hidden activity.
- Status dot uses terracotta pulse while ready and static gray while paused.

### Recommendation

- Auto mode displays `Recommended: <type>` or `推荐：<类型>`.
- Manual mode displays `Manual: <type>` or `手动：<类型>`.
- The recommendation line is secondary metadata, not a CTA.

## Accessibility

- All icon-only buttons need `aria-label`.
- Textarea and select require labels or accessible names.
- Focus rings must be visible on buttons, textarea, select, and bookmarklet link.
- Do not rely on color alone; selected elements also use borders and labels.
- Respect reduced motion.
- Controls should remain reachable and readable at 375px width.
- Avoid hover-only critical controls.

## Responsive Rules

- Install page:
  - Desktop: three cards in a row.
  - Mobile: one card per row.
  - Hero font should not scale with viewport beyond defined clamp.
- Floating panel:
  - Desktop: 360px.
  - Mobile: full available width minus 20px.
  - No horizontal overflow.
  - Button/select row may stay two columns if labels fit; otherwise allow stable wrapping in future.

## Implementation Notes

- Prefer CSS custom properties for shared tokens.
- Keep bookmarklet CSS self-contained under `ca-*`.
- Do not import external fonts for the alpha bookmarklet.
- Do not add decorative images or SVG illustrations for this product stage.
