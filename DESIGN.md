---
version: alpha
name: Carousel Cloner Studio
description: A local-first creator operations console for building grocery carousel posts.
colors:
  primary: "#17201B"
  on-primary: "#FFFFFF"
  secondary: "#5F6B63"
  accent: "#1F6A3D"
  accent-soft: "#E2F2E8"
  neutral: "#F6F4EE"
  surface: "#FFFFFF"
  surface-raised: "#FBFAF6"
  border: "#DED9CE"
  muted: "#7B837B"
  danger: "#B42318"
  warning: "#8A5A00"
typography:
  display:
    fontFamily: '"BBH Bogle", ui-sans-serif, system-ui'
    fontSize: 44px
    fontWeight: 760
    lineHeight: 1
    letterSpacing: 0
  h1:
    fontFamily: '"BBH Bogle", ui-sans-serif, system-ui'
    fontSize: 32px
    fontWeight: 740
    lineHeight: 1.08
    letterSpacing: 0
  h2:
    fontFamily: '"BBH Bogle", ui-sans-serif, system-ui'
    fontSize: 18px
    fontWeight: 730
    lineHeight: 1.2
    letterSpacing: 0
  body:
    fontFamily: ui-sans-serif, system-ui
    fontSize: 16px
    fontWeight: 450
    lineHeight: 1.55
    letterSpacing: 0
  label:
    fontFamily: '"BBH Bogle", ui-sans-serif, system-ui'
    fontSize: 13px
    fontWeight: 720
    lineHeight: 1.2
    letterSpacing: 0
rounded:
  sm: 6px
  md: 8px
  lg: 14px
  xl: 22px
  full: 999px
spacing:
  xs: 6px
  sm: 10px
  md: 16px
  lg: 24px
  xl: 36px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    height: 46px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: 44px
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: 20px
  page:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
  status:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.full}"
  metadata:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
  divider:
    backgroundColor: "{colors.border}"
  muted-text:
    textColor: "{colors.muted}"
  error:
    textColor: "{colors.danger}"
  warning:
    textColor: "{colors.warning}"
---

## Overview

Carousel Cloner Studio should feel like a calm creator operations desk: fast, clear, and trustworthy. The UI supports repeated production work, so it should prioritize scanability over decoration and always make the next action obvious.

## Colors

The palette uses warm grocery-paper neutrals with high-contrast ink and one fresh green action color. Green is reserved for progress, selected states, and primary creator actions. Surfaces should stay mostly white or warm off-white so product imagery remains the focus.

## Typography

Type should be compact and sturdy. Use strong headings for orientation, small uppercase labels for metadata, and readable body copy. Letter spacing stays at 0.

## Layout

Use a restrained dashboard layout with a command panel, results panel, and narrow utility modules. Keep spacing consistent and avoid nested cards. Mobile screens should feel like a handoff checklist first, then an image review surface.

## Elevation & Depth

Depth is minimal: one subtle border, a soft shadow for important panels, and no decorative gradients or orbs. Product images can carry visual richness.

## Shapes

Use 8px radius for buttons and inputs, 14px for panels, and larger radii only for full mobile image review surfaces.

## Components

Primary buttons are dark ink with white text. Secondary actions are white with borders. Status pills are compact and subdued. QR codes and 9:16 image previews should have fixed dimensions so the layout does not jump.

## Do's and Don'ts

Do make the generation flow feel decisive and utility-first. Do keep product photos large and caption tools easy to copy. Do not use purple gradients, oversized marketing hero sections, decorative blobs, or explanatory UI copy that crowds the task.
