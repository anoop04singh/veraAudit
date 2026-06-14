# VeraAudit Frontend Design

## Overview

VeraAudit uses a dark, proof-driven visual language built to feel:

- technical
- high-trust
- security-focused
- slightly industrial
- modern, but not soft or consumer-casual

The interface is designed around the idea of **verifiable infrastructure** rather than generic SaaS. The visual tone intentionally combines:

- terminal aesthetics
- chain/security dashboards
- red-alert severity signaling
- dense but controlled information surfaces

The product should feel like an audit command center, not a marketing website.

## Design Goals

The frontend design is built around five goals:

1. Make the product feel credible for security-critical workflows
2. Keep the experience visually strong without becoming noisy
3. Surface proof, history, and audit state clearly
4. Preserve a consistent “forensic / evidence-chain” mood
5. Stay readable across desktop and mobile

## Brand Direction

### Core personality

- Assertive
- Precise
- Verifiable
- Technical
- Mainnet-ready

### Product positioning expressed in design

The design communicates:

- audits are evidence, not just text
- each action has a traceable chain
- severity matters
- verification is central

This is why the UI relies heavily on:

- monospaced metadata
- strong uppercase headings
- structured panels
- red-accented proof surfaces
- terminal and pipeline visual motifs

## Color System

Defined in [frontend/src/styles.css](/C:/Users/singa/Downloads/veraAudit/frontend/src/styles.css).

### Base palette

- `--background: #030303`
- `--surface: #0a0a0b`
- `--surface-soft: #12131a`
- `--surface-deep: #3d0a0a`
- `--surface-panel: rgba(61, 10, 10, 0.42)`
- `--border: #27272a`
- `--border-strong: rgba(220, 38, 38, 0.6)`
- `--text: #e2e1eb`
- `--muted: #a1a1aa`
- `--muted2: #70707a`

### Accent palette

- `--red: #dc2626`
- `--red-soft: rgba(220, 38, 38, 0.14)`
- `--red-faint: rgba(220, 38, 38, 0.08)`

### Semantic status palette

- `--ok: #22c55e`
- `--high: #ef4444`
- `--med: #f59e0b`
- `--low: #f97316`

### Design interpretation

- Black + deep red creates the core VeraAudit identity
- Muted grays carry secondary information and chain metadata
- Green is used sparingly for clean or verified states
- Amber/orange/red establish audit severity hierarchy

The palette should remain **dark-first** and **evidence-first**. Bright decorative colors should be avoided unless they support state or trust semantics.

## Typography

### Fonts

- Display / body: `Oswald`
- Monospace / technical metadata: `JetBrains Mono`

### Usage

- `Oswald` is used for:
  - page titles
  - hero headlines
  - buttons
  - card titles
  - major section headings

- `JetBrains Mono` is used for:
  - hashes
  - blob IDs
  - transaction IDs
  - eyebrow labels
  - timestamps
  - status/meta labels

### Typography behavior

The type system intentionally contrasts:

- **compressed, forceful display text**
- **small machine-like metadata**

This gives the UI its “operator console + investor-grade product” feel.

## Layout System

### Global width

The primary content width is controlled by:

- `--section-width: min(1280px, calc(100% - 32px))`

This keeps the layout wide and premium on desktop while preserving edge spacing on smaller screens.

### Structural pattern

Most pages follow:

- sticky / compact header
- section container
- stacked panels
- card grids
- report/detail surfaces

### Main layout traits

- generous section spacing
- boxed content instead of floating content
- heavy use of bordered panels
- stable alignment between header and page content

## Background Language

The app shell uses multiple layers:

- radial red glow
- dark vertical gradient
- ambient noise texture
- scanline overlay
- grid overlay
- pointer-reactive spotlight

These combine to create a “chain intelligence / proof environment” rather than a flat dashboard.

### Landing page hero

The landing page adds a particle-field canvas background:

- red signal dots
- perspective field effect
- light pointer response
- reduced-cost animation tuned for performance

This is the main expressive motion surface of the product.

## Shape Language

### Corners

- Global radius is intentionally tight: `4px`

This supports the product’s technical, precise feeling.

### Borders

Borders are important in VeraAudit. Surfaces are defined through:

- thin neutral borders for default structure
- stronger red borders for emphasis, selection, or hover

### Containers

Primary surfaces are:

- `panel`
- `metric-card`
- `flow-item`
- `split-item`
- `evidence-card`
- `taxonomy-card`
- `audit-card`
- `rag-source-card`

The overall design language prefers **framed data blocks** over airy cards.

## Motion System

### Motion philosophy

Motion should support:

- system activity
- reveal timing
- live audit progression
- scanning / verification atmosphere

It should not feel playful.

### Current motion patterns

- reveal-on-scroll transitions
- subtle route transitions
- orbital ring rotation in audit visuals
- scanning line movement
- pulsing status dots
- pipeline activity indicators
- animated hero particle field

### Performance note

The landing particle field has already been optimized:

- lower DPR
- reduced density
- capped frame rate
- visibility-based pausing

Future animation work should preserve that performance discipline.

## Component Design Patterns

## 1. Header

The header is compact, black, and utility-driven.

### Desktop behavior

- left: logo + brand label
- right: ecosystem note + navigation tabs

### Mobile behavior

- non-sticky
- compressed spacing
- simplified top row
- hidden secondary note
- equal-width nav tabs

This avoids wasting vertical space on small screens.

## 2. Buttons

Buttons are uppercase, structured, and assertive.

### Variants

- `btn--primary`
  strong red action
- `btn--ghost-technical`
  mono/technical secondary action
- `btn--sm`
  compact action, often used in cards

### Behavior

- bordered by default
- red fill for primary intent
- minimal hover lift

The button style should remain product/system-oriented, not rounded or app-store-like.

## 3. Metrics

Metric blocks are large, bold, and minimal.

They use:

- strong numeric emphasis
- mono labels
- sparse decoration

The goal is to make the system feel active and credible without visual overload.

## 4. Evidence / Architecture Cards

Used on the landing page to explain:

- fetch
- RAG
- Gemini analysis
- Walrus storage
- Sui anchor

These cards are:

- explanatory
- bold
- presentation-friendly
- slightly cinematic

They should feel like core infrastructure modules.

## 5. Recent Audit Cards

Used on the audit workspace homepage.

Current design direction:

- compact and consistent
- severity tag visible immediately
- contract hash as primary identity
- blob / tx values reduced to structured meta rows
- timestamp treated as a footer, not body clutter

These cards should remain scannable even with long hashes.

## 6. Audit History Cards

Used on the audit details page.

Design goals:

- display the audit as a proof event
- link contract, Walrus blob, and tx clearly
- preserve severity and run chronology
- allow reopening specific proof records

They are more evidence-oriented than promotional.

## 7. Audit Report

The report surface is the highest-information section in the product.

It contains:

- summary
- severity badge
- severity counts
- findings
- recommendations
- optional RAG source cards

### Report design intent

- serious and readable
- structured enough for technical review
- not visually overwhelming

### Loading state

The report now includes a skeleton state while the blob-backed details are loading. This avoids misleading temporary zero-values and improves perceived responsiveness.

## 8. Pipeline Visualization

The audit pipeline is a major product differentiator and is reflected visually.

The UI includes:

- live step progress
- step status colors
- audit log output
- scanner-style loading visuals

This gives users confidence that:

- real work is happening
- the system is not just waiting on a black box
- the audit can be traced step-by-step

## Severity Semantics

Severity is one of the strongest visual systems in the app.

### Mapping

- `clean`: green
- `low`: orange
- `medium`: amber
- `high`: red
- `critical`: strong red

### Usage

Severity appears in:

- recent audit cards
- audit history
- audit report summary
- findings list
- statistics

This should remain consistent across all future additions.

## Data Presentation Rules

### Hashes and IDs

- use `JetBrains Mono`
- shorten when possible
- keep full values behind links or detailed views

### Timestamps

- treat as secondary information
- keep them readable but subdued

### Labels

- short
- uppercase where appropriate
- mono for technical metadata

### Cards

Avoid stacking too many long raw values without structure. Prefer:

- title / kicker
- 2 or 3 metadata rows
- timestamp footer

instead of ungrouped text blocks.

## Responsive Design

### Desktop

The product is designed to feel cinematic and confident on large screens:

- wide hero layouts
- multi-column grids
- strong left/right balance

### Tablet

Grids collapse progressively:

- 3 columns to 2
- 2 columns to 1

without changing the product tone.

### Mobile

Mobile prioritizes:

- compact header
- single-column reading
- preserved contrast
- full-width tabs and controls
- less visual clutter

The goal is not to replicate the desktop mood exactly, but to preserve trust and clarity within a smaller footprint.

## Accessibility and Readability

The UI already includes several strong readability decisions:

- high contrast between text and background
- consistent use of muted secondary text
- large display type for key moments
- separated metadata and narrative content
- reduced motion support

Future work should continue to improve:

- keyboard visibility
- focus states
- form guidance
- ARIA labeling in interactive audit cards and report controls

## What Makes the Design Distinctive

VeraAudit’s design is defined by this combination:

- black / deep red trust palette
- compressed, forceful typography
- forensic proof surfaces
- structured chain metadata
- live pipeline mechanics
- immutable-evidence atmosphere

It should always feel closer to:

- a security operations interface
- an audit evidence console
- a mainnet verification dashboard

than to a generic startup template.

## Future Design Direction

As VeraAudit evolves into a broader agent-centric trust product, the frontend can expand into:

- machine-readable audit confidence indicators
- agent trust badges
- protocol reputation graphs
- continuous monitoring timelines
- upgrade diff views
- wallet-integrated verification surfaces

### Design principle for future expansion

Even with these additions, the product should continue to center:

- proof
- trust
- traceability
- clarity under technical complexity

## Source of Truth

This design system is derived from the current implementation in:

- [frontend/src/styles.css](/C:/Users/singa/Downloads/veraAudit/frontend/src/styles.css)
- [frontend/src/App.jsx](/C:/Users/singa/Downloads/veraAudit/frontend/src/App.jsx)
- [frontend/src/pages/LandingPage.jsx](/C:/Users\singa\Downloads\veraAudit\frontend\src\pages\LandingPage.jsx)
- [frontend/src/pages/HomePage.jsx](/C:/Users/singa/Downloads/veraAudit/frontend/src/pages/HomePage.jsx)
- [frontend/src/pages/AuditPage.jsx](/C:/Users/singa/Downloads/veraAudit/frontend/src/pages/AuditPage.jsx)

Any future redesign should treat this file as the high-level intent document for the current VeraAudit frontend language.
