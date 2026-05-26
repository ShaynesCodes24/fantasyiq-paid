# Nano Banana Visual Prompts

Use these prompts with the installed VS Code extension `doggy8088.nanobanana`.

Workspace defaults are already set for:

- Model: `gemini-3-pro-image-preview`
- Style: `product-showcase`
- Size: `2K`
- Output: `public/assets/generated`

Before generating, run `Nano Banana: Set Gemini API Key` from the VS Code Command Palette if you have not already stored
your Gemini key.

## Homepage Hero Art

Recommended settings:

- Style: `product-showcase`
- Aspect ratio: `21:9`
- Output filename target: `fantasyiq-hero-command-room.png`

Prompt:

```text
Create a premium cinematic hero background for MyFantasyIQ, a fantasy football decision intelligence product.

Scene: a modern nighttime fantasy football command room with a dark emerald field-inspired environment, subtle stadium light beams, glassy analytics panels, roster cards, waiver/trade signal charts, and a refined sports strategy desk. The mood should feel elite, calm, expensive, analytical, and decisive.

Brand palette: deep near-black green #00110F, dark field green #123F34, warm gold #E7B95A, cream #F9F0DC, paper white #FFFDF9. Gold should be used sparingly as signal highlights, not as a dominant wash.

Composition: wide 21:9 website hero image. Leave clean darker negative space on the left third for large white headline text. Put the premium command-center detail on the right half. Add realistic depth, subtle glow, crisp contrast, and polished materials. Avoid clutter.

Do not include readable text, brand logos, ESPN marks, player likenesses, team logos, watermarks, random typography, or UI labels. Any screens should use abstract unreadable charts and clean placeholder data shapes only.
```

## Social Preview Card

Recommended settings:

- Style: `article-cover`
- Aspect ratio: `16:9`
- Output filename target: `social-preview-premium.png`

Prompt:

```text
Create a premium social preview image for MyFantasyIQ, a fantasy football decision desk.

Show a dark emerald and gold command-center scene with a single glowing "decision brief" panel shape, abstract fantasy football roster cards, waiver/trade signal lines, and a quiet stadium-light atmosphere. It should feel like Bloomberg Terminal meets fantasy football draft room.

Use deep green, cream, and restrained gold. Make the center-right visual strong, with clean negative space for later text overlay. High-end SaaS product mood, not a loud sportsbook ad.

No readable words, no logos, no ESPN branding, no team logos, no player likenesses, no watermarks.
```

## Feature Card Texture

Recommended settings:

- Style: `minimal-flat-illustration`
- Aspect ratio: `4:3`
- Output filename target: `fantasyiq-feature-texture.png`

Prompt:

```text
Create a subtle premium texture panel for fantasy football intelligence feature cards.

Abstract shapes only: roster depth bars, waiver priority arrows, trade value curves, draft board tiers, schedule difficulty bands, and football field geometry. Dark emerald background, cream data shapes, tiny warm-gold signal marks. Elegant and restrained.

The image must be usable behind text, so keep contrast soft, avoid busy detail, and do not include readable words, logos, players, teams, or watermarks.
```
