# Label Specification

Reference image: `data/Label Example.png`

## Physical Format

- **Label stock:** Dymo large shipping label, 59mm × 102mm (portrait feed)
- **Print orientation:** Landscape — the 102mm dimension is horizontal,
  59mm is vertical
- **Label dimensions as printed:** ~102mm wide × ~59mm tall

## Layout

The label is divided into two rows and two columns:

```
┌──────────────────────────────────────────────────────┐
│  [FLAG LOGO]     The League Of                       │
│                  Amazing Programmers                  │
│                  jointheleague.org (858) 284-0481     │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│    5     │       Cutebot Battery Addon               │
│          │            Joysticks                       │
│  [QR]    │                                           │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

### Top row — Header

| Element | Position | Description |
|---------|----------|-------------|
| Logo | Top-left | League flag icon (lightning bolt flag) |
| Org name | Top-right, bold | "The League Of Amazing Programmers" |
| Contact line | Below org name | `jointheleague.org (858) 284-0481` |

### Bottom row — Content (two columns)

| Element | Position | Description |
|---------|----------|-------------|
| Number | Left column, large bold | Kit/pack identifier number (see numbering below) |
| QR code | Left column, below number | Links to the entity's detail page |
| Name / description | Right column, large bold centered | The kit or pack name, wrapping to multiple lines |

## Numbering Scheme

The prominent number on the label identifies what the label is for.

| Entity | Number format | Example | Meaning |
|--------|--------------|---------|---------|
| Kit | `{kitNumber}` | `5` | Kit #5 |
| Pack | `{kitNumber}/{packSequence}` | `5/2` | Second pack in kit #5 |

- **Kit numbers** are integers from the `kit.number` field.
- **Pack numbers** use the kit number, a forward slash, and a sequential
  pack index within that kit. The pack sequence is based on the pack's
  position within its kit (ordered by pack ID or a future `sequence`
  field).

## QR Code

- Links to the entity's detail page in the inventory app
- Kit labels: `{baseUrl}/k/{kitId}`
- Pack labels: `{baseUrl}/p/{packId}`
- Sized to fit in the left column below the number (~20mm)

## Content Area (right column)

- Displays the pack or kit name in large bold text
- Text is centered vertically and horizontally in the available space
- Long names wrap to multiple lines

## Differences from Current Implementation

The current label service (`server/src/services/label.service.ts`)
generates a **portrait** layout with a vertically stacked design:

1. Org name centered at top
2. QR code centered
3. Title centered below QR
4. Subtitle below title
5. Contact info at footer

The target layout is **landscape** with a two-column grid, the large
number identifier, and the league flag logo. Key changes needed:

- Rotate to landscape orientation (swap width/height)
- Add the flag logo image asset
- Implement two-column layout: number + QR on left, name on right
- Add the kit/pack numbering scheme
- Move org name and contact to the header row
- Remove the vertical stacked layout

## Label Types

### Kit label

- **Number:** Kit number (e.g., `5`)
- **Name:** Kit name (e.g., "Cutebot Battery Addon Joysticks")
- **QR:** `/k/{kitId}`

### Pack label

- **Number:** Kit number / pack sequence (e.g., `5/2`)
- **Name:** Pack name
- **QR:** `/p/{packId}`

### Computer label

Computer labels are not shown in the reference image. Current behavior
(hostname or model as title, serial number and credentials as details)
can be adapted to the new two-column layout. The number field could
use the hostname or be omitted — TBD with stakeholder.
