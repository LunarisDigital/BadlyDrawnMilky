# BadlyDrawnMilky — homepage

A hand-drawn, pastel homepage for Milky (the very good, very badly drawn dog) and his crew.

## The experience

The page is a normal, single-scroll page — there's no scroll-jacking or state machine. Each
section reveals itself as it scrolls into view (IntersectionObserver-driven fade/slide-ins, see
`.reveal-text`/`.m2-reveal`/etc. in `js/main.js`), and several sections also carry their own
scroll- or click-triggered animations:

1. **Hero (`#section-1`)** — Milky's looping meadow scene plays immediately, composited via a
   `<canvas>` that color-keys the source video's near-black background out in real time (see
   `startBlackKeyedCanvas` in `js/main.js`) so it reads as a transparent character over the page's
   own background instead of a video rectangle.
2. **M2 table scene (`#section-2`)** — a "grooming table" stage with Milky plus four tappable
   props (nail clippers, nail polish, toothbrush, teddy bear). Each prop has its own
   shadow/idle-wobble/tap-pop treatment and is keyboard-accessible (`role="button"`,
   `tabindex="0"`, Enter/Space handlers). Desktop and mobile use different art/layout for this
   stage (`.m2-groom-cluster` vs. `.m2-mobile-prop`).
3. **Best-of Content Reel + Meet the Crew (`#section-3`)** — a horizontally-panning gallery strip
   (`#bocr-viewport`, drag or scroll to pan) inside a hand-drawn "museum frame", followed by
   platforms for Milky, Baby, and Princess, each playing its own idle-loop clip.
4. **Candle / Social Proof room (`#section-4`)** — a dark room; clicking/tapping the candle three
   times lights it and reveals Milky/Baby/Princess celebrating with party favors. The candle rig
   is `position: sticky` and follows scroll with a spring-physics wobble while the section is in
   view (see the candle-follow block in `js/main.js`).

Most character/crew clips are keyed transparent at runtime from a plain `<video>` source into a
`<canvas>` — either against near-black (`startBlackKeyedCanvas`) or, for the section-4 crew whose
own ink is too close to black for that trick, against a solid green backing baked in at transcode
time and keyed at runtime instead (see the `CREW_GREEN` constants/comments in `js/main.js`).

## Running locally

Any static server works, e.g.:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the served URL. Opening `index.html` directly via `file://` mostly works too, but some
browsers restrict `<video>`/canvas pixel access over `file://`, so a local server is the more
reliable option.

## Project structure

```
index.html                 markup for every section
css/style.css               all styling
js/main.js                  scroll-reveal observers, canvas video-keying, interactive props,
                             candle-follow physics, gallery drag/wheel panning
assets/web/                 web-ready images + H.264/HEVC video clips actually used by the site
site-improvement-suggestions.txt   running punch-list from periodic site reviews
homepage-plan.txt, Home Content Summary.txt   copy/section planning notes
```

## Notes & knobs

- **Scroll reveals** — most section intros/props use a shared IntersectionObserver pattern
  (`.reveal-text`, `.m2-reveal`, etc.) that adds `.is-revealed` once and then unobserves; see the
  top of `js/main.js`.
- **Gallery panning (`#bocr-viewport`)** — supports mouse wheel (redirected to horizontal scroll,
  falls through to normal page scroll once fully panned to either end) and real click-and-drag.
- **Candle interaction** — three clicks/taps on `#candle-only` ignite it (spark → looping fire),
  which after a delay also reveals the section-4 crew; keyboard-accessible the same way as the M2
  props.
- **Social links** — the footer's Instagram/TikTok/Shop links are placeholders; drop in real URLs
  before launch.
- **Known gaps** — no real follower/stat numbers yet (tone-only placeholder copy), no Brand Path
  CTA banner section built yet, footer copy still says "Placeholder footer content." See
  `site-improvement-suggestions.txt` for the current list of known issues and suggested fixes.
