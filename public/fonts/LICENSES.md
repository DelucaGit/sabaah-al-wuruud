# Bundled fonts: sources and licences

All fonts are bundled so the app works fully offline. Declared in `src/styles/fonts.css`.

| File | Family | Used for | Version | Licence | Source |
|---|---|---|---|---|---|
| `Carlito-Regular.woff2`, `Carlito-Bold.woff2` | Carlito | English UI (Calibri-metric-compatible) | 1.104 | SIL Open Font License 1.1 | google/fonts repo, `ofl/carlito/` (https://github.com/google/fonts/tree/main/ofl/carlito); upstream https://github.com/googlefonts/carlito |
| `Amiri-Regular.woff2`, `Amiri-Bold.woff2` | Amiri | Adhkar text | 1.002 | SIL Open Font License 1.1 | google/fonts repo, `ofl/amiri/` (https://github.com/google/fonts/tree/main/ofl/amiri); upstream https://github.com/aliftype/amiri |
| `UthmanicHafs-v18.woff2` | KFGQPC HAFS Uthmanic Script | Quran verses | 0.18 | KFGQPC End-User Licence (see below) | King Fahd Glorious Quran Printing Complex (https://qurancomplex.gov.sa/techquran/dev/), obtained via the mirror https://cdn.jsdelivr.net/gh/thetruetruth/quran-data-kfgqpc@main/hafs/font/hafs.18.woff2 |

Carlito and Amiri were converted from the upstream TTF files to WOFF2 with fontTools. This changes only
the container format (compression), not the glyphs or font names. The Uthmanic Hafs file is bundled
exactly as downloaded, unconverted and unmodified.

## Carlito

Copyright 2013 The Carlito Project Authors (https://github.com/googlefonts/carlito), with Reserved Font Name "Carlito".

## Amiri

Copyright 2010-2022 The Amiri Project Authors (https://github.com/aliftype/amiri).

Carlito and Amiri are licensed under the SIL Open Font License, Version 1.1:
https://openfontlicense.org/open-font-license-official-text/

## KFGQPC HAFS Uthmanic Script

Copyright (c) 2010 King Fahd Glorious Quran Printing Complex (KFGQPC), AlMadinah AlMunawarrah,
Kingdom of Saudi Arabia. ISBN 978-603-8010-15-0. All rights reserved.

The end-user licence embedded in the font file (name table) says:

> Permission is hereby granted, Free of Cost, to any person obtaining a copy of this Font accompanying
> this license, the rights to Use, Copy, Distribute, subject to the following conditions:
>
> 1. The Font Software cannot be Sold, Modified, Altered, Translated, Reverse Engineered, Decompiled,
>    Disassembled, Reproduced or Attempted to discover the Source Code of this Font in no means.
> 2. The Font Software is provided "AS IS", and KFGQPC makes no warranties as to its use or
>    performance, fitness for a particular purpose. [...]

This app is free and does not modify the font, so bundling it falls under "Use, Copy, Distribute".
The file must not be subset, converted or otherwise altered.
