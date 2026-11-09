# Bundled typefaces

`specs/017-ui-refresh` requires **five static font files** in this directory.
They **are committed** to this repo, together with `OFL.txt` — a fresh clone
needs no font download. Both families are SIL Open Font License 1.1, which
permits redistribution with the licence alongside.

If you ever replace them, re-run `npm run fonts:link` so the copies under
`android/app/src/main/assets/fonts/` match, then rebuild natively — a Metro
reload does not pick up new native assets.

## How these were produced

Google Fonts serves both families as VARIABLE fonts, and a variable `.ttf`
does not work here (see below). The committed files are:

- `BricolageGrotesque-ExtraBold.ttf` — a static instance published upstream
  at `ateliertriay/bricolage` (`fonts/ttf/`).
- The four `Inter-*.ttf` — static instances cut from the variable
  `Inter[opsz,wght].ttf` in `google/fonts` with
  `fonttools varLib.instancer`, pinned at `opsz=14` and `wght=500/600/700/800`.

Verify a replacement has no `fvar` table before committing it; a variable
font is accepted silently by the build and then renders as the system face.

| File | Family | Weight | Source |
|---|---|---|---|
| `BricolageGrotesque-ExtraBold.ttf` | Bricolage Grotesque | 800 | Google Fonts |
| `Inter-Medium.ttf` | Inter | 500 | Google Fonts |
| `Inter-SemiBold.ttf` | Inter | 600 | Google Fonts |
| `Inter-Bold.ttf` | Inter | 700 | Google Fonts |
| `Inter-ExtraBold.ttf` | Inter | 800 | Google Fonts |

## Static instances only — this is not a preference

Google Fonts serves both families as **variable** fonts by default. A variable
`.ttf` will not work here. Download the **static** instances (on Google Fonts,
expand "Static" in the download panel, or take them from the `static/`
subfolder of the family zip).

## Why one file per weight

Android's `ReactFontManager` resolves a bundled face by **asset file name**,
and collapses any numeric `fontWeight >= 700` onto a `_bold` filename suffix:

```
fonts/<fontFamily><""|_bold|_italic|_bold_italic>.<ttf|otf>
```

So `{ fontFamily: 'Inter-Bold', fontWeight: '700' }` looks for
`fonts/Inter-Bold_bold.ttf`, does not find it, and **silently** returns the
system typeface. There is no exception and no warning.

That is why **no numeric font weight may be set anywhere** (FR-007a) — not in
a style, not as a `font-bold` class, not in `headerTitleStyle`. Weight is
carried by the family name alone.

## Licence

Both families are SIL Open Font License 1.1. Place the licence text alongside
the fonts as `OFL.txt` — the OFL requires it to ship with the app.

## Verify

```bash
npm run fonts:verify   # fails loudly if any face is missing
npm run fonts:link     # copies into android/app/src/main/assets/fonts/
```

Then rebuild natively (`npm run android`) — a Metro reload is not enough.
