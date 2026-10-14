const BLACK_KEY_SIMILARITY = 24; // 0-441, distance from black below this is fully transparent
const BLACK_KEY_BLEND = 40;      // width of the soft fade-in ramp above SIMILARITY

// 2026-09-07: raw-pixel edge scan (ffmpeg rawvideo dump + a small Node
// script, same technique as the candle-fire ring bug below) of the section-3
// crew clips confirmed the same class of "black outline" bug the candle's
// own CANDLE_KEY_BLEND was created for: real, muddy, near-gray edge pixels
// (anti-aliased ink blending toward the black background) that the default
// SIMILARITY+BLEND=64 cutoff was marking 100% opaque despite being visibly
// dim/desaturated, instead of letting them ramp through partial
// transparency like a real soft edge should.
//
// UNLIKE the candle, these clips have real dark ink linework (eyes, nose,
// facial detail) sitting fairly close to pure black by design — a first
// attempt at reusing the candle's own CANDLE_KEY_BLEND=220 verbatim looked
// right on paper (the math easily covers the ring pixels' measured
// distances) but, checked the proper way this project already knows to
// check blend/blur tuning — rendering actual composited crops from the real
// footage at candidate values and reading them with the Read tool, not
// reasoning from distances alone — visibly washed OUT Milky's own outline
// into a faded dusty-pink instead of crisp dark brown, since his ink sits
// close enough to black that a 220-wide ramp fades it too. Rendered the
// same crop at 40 (visible ring, confirmed), 50/55/60 (ring gone, ink still
// reads dark), 70/100 (ink already visibly paling) — 60 is the value that
// clears the ring with a bit of margin while keeping ink crisp.
//
// 2026-09-13: still used by bocr-milky-intro.mp4 (its own low-res GIF
// source, not yet redone) and the isolated bocr-milky-pee.mp4 stream — but
// bocr-milky-loop.mp4/bocr-baby-loop.mp4/bocr-princess-loop.mp4 themselves
// moved OFF this black-key path entirely (see CREW_GREEN_BLEND below and
// the section-3 platforms block's own call sites) after "the lines aren't
// black" turned out to be exactly this same close-to-black-can't-separate-
// from-black-background problem, just severe enough this time that no
// blend value fixed it — confirmed by literally rendering this exact
// black-key path against the same clean source used for the green-key
// rebuild: still visibly washed out even at this tuned 60, worse at the
// hero/section-1 default of 40. Ink this dark just can't be reliably split
// from a black background by a plain black key; the section-4 crew already
// hit the same wall for the same reason (see the long comment at
// CREW_GREEN_BLEND's own definition) and solving it there first is what
// made rechecking it here straightforward.
const CREW_KEY_BLEND = 60;

// 2026-09-14: "the pee seemed to have a dark outline on it" — real,
// confirmed via the same raw-pixel-edge-scan + render-and-Read technique
// used for the candle-fire ring bug (ffmpeg rawvideo dump of the pee
// chain's own CROP window + a small Node/sharp script compositing
// candidate blend values over the site's actual pastel sky, viewed with
// the Read tool rather than reasoned about from distances alone). Root
// cause: bocr-milky-pee.mp4's stream is a bright, highly-saturated yellow
// (edge-to-edge distance-from-black in the ~300-370 range) anti-aliased
// against a pure-black background, same as every other clip on this page —
// but CREW_KEY_BLEND=60 was tuned against Milky's own face ink (a dark
// color close to black), not this stream, and is nowhere near wide enough
// to pull the stream's own edge pixels (measured dist ~40-170, e.g. a
// muddy (87,79,27)) into the partial-alpha ramp where applyBlackKey's
// existing un-premultiply logic can recover their true bright color —
// short of that ramp, those pixels snap straight to 100% opaque *still
// carrying their darkened, blended-toward-black raw color*, which is
// exactly what reads as a dark outline. Rendered actual composites at
// blend=60 (current: hard dark ring, confirmed matches the reported bug),
// 150/250 (ring fades but still visible), 300/350 (clean soft edge, no
// ring) — 320 is picked with the same "clear margin past where the defect
// resolves" convention as CREW_KEY_BLEND/CANDLE_KEY_BLEND's own tuning
// rather than sitting right at the edge of where it stops looking bad.
// Only affects the pee-chain tiles' own call site below; every other clip
// keeps its existing blend untouched.
const PEE_KEY_BLEND = 320;

// Shared by both the section-4 party-favor crew and the section-3
// bocr-{milky,baby,princess}-loop clips — all green-composited from a real
// per-character alpha master for the same reason: their ink sits too close
// to black for CREW_KEY_BLEND above to separate it from a black background
// (see that constant's own 2026-09-13 update). Values/reasoning documented
// where CREW_GREEN_BLEND was first tuned, at its original section-4 call
// site in the candle-ignite block below.
const CREW_GREEN = [0, 255, 0];
const CREW_GREEN_SIMILARITY = 45;
const CREW_GREEN_BLEND = 120;

// 2026-09-14: "do the same for milky [only, i.e. his idle-loop clip] as
// the pee" — same raw-pixel-dump + render-and-Read diagnostic as
// PEE_KEY_BLEND above, this time on bocr-milky-loop.mp4 at CREW_GREEN_*'s
// current values. Milky's own thick black ink outline (genuine, intended
// art — every character on this page is drawn with one, see CREW_KEY_
// BLEND's own comment) is NOT the bug and was left alone; what direct
// pixel sampling along his silhouette actually found is a distinct, real
// green fringe riding just outside that ink line — e.g. a sampled edge
// pixel (45,92,23) at dist=171 from key-green, past CREW_GREEN_BLEND's
// sim+blend=165 cutoff, so it snaps to 100% opaque still carrying its raw
// green-shifted color instead of landing in the partial-alpha ramp where
// applyBlackKey's un-premultiply/spill-suppression would clean it up —
// same underlying mechanism as the pee ring, just a much narrower miss (a
// ~50-unit gap here vs. the pee clip's ~300-unit one), and reading as a
// faint green halo rather than a hard dark ring because of it.
// Rendered composites at 120 (current: visible green fringe, confirmed),
// 180/220 (fringe fades substantially), 260/300 (fringe gone but a new,
// different artifact appears — a thin magenta/pink fringe instead, from
// un-premultiply's own divide-by-alpha amplifying noise at near-zero
// alpha, worse the wider the ramp gets pushed). Unlike the pee clip, there
// is no blend value here that's simply "clean" — past ~220 one fringe
// color is being traded for another — so 200 is picked as the best
// balance (green fringe reduced to barely-there, magenta not yet visibly
// present) rather than chasing full elimination the way PEE_KEY_BLEND
// could. Deliberately a separate constant, not a change to CREW_GREEN_
// BLEND itself — Baby/Princess and the section-4 party-favor crew all
// share that constant and weren't part of this ask; only Milky's own loop
// call site below uses this.
const MILKY_GREEN_BLEND = 200;

// Used by startBlackKeyedCanvas below — turns near-black pixels in `data`
// (an ImageData.data array, mutated in place) transparent, with a soft
// ramp at the edge so it doesn't look jagged. `blend` overrides
// BLACK_KEY_BLEND — see the candle-fire/spark call site for why a caller
// would want a wider one: these source clips are anti-aliased against
// their black background, so the 1px edge ring between "fully keyed
// transparent" and "fully opaque" is actually a blend of flame-color and
// black, not flame-color at reduced opacity — with the default 40-wide
// ramp, plenty of those blended-toward-black edge pixels already clear
// the "fully opaque" distance threshold while still being visibly dark/
// muddy, which reads as a thin dark ring around the shape. That ring is
// too subtle to notice at the crew characters' normal display size, but
// candle-fire/spark are drawn at 24-40vw — tens of times bigger — so it
// became clearly visible. A wider ramp keeps more of those dim edge
// pixels partially transparent instead of snapping to fully opaque,
// which both shrinks the ring and, as a side effect, gives the flame a
// softer glow-like falloff at its edge instead of a hard sprite outline
// (a reasonable look for a flame regardless of the original bug).
// `keyColor`/`similarity` let a caller key against a color other than pure
// black — see the section-4 crew's own green-screen call site for why:
// their ink outline sits too close to (0,0,0) for a black key to ever
// separate ink from background (both read as "the same color"), so those
// clips are composited at transcode time over a solid green backing
// instead (ffmpeg's own real alpha channel decides what's background,
// not a runtime color guess) and keyed against green here — every other
// call site on the page keys against the default black/24 and is
// unaffected.
function applyBlackKey(data, blend, keyColor, similarity, inkLighten) {
  const b = blend || BLACK_KEY_BLEND;
  const sim = similarity || BLACK_KEY_SIMILARITY;
  const [kr, kg, kb] = keyColor || [0, 0, 0];
  const suppressSpill = !!keyColor && (kg > kr && kg > kb || kr > kg && kr > kb || kb > kg && kb > kr);
  // The green-keyed crew clips' own ink ("the lines are supposed to be
  // black, some of them are transparent, some are brown") traced to
  // yuv420p's 4:2:0 chroma subsampling on the (then-)source clips: color
  // info is stored at half resolution in both dimensions, so thin ink
  // strokes just 1-2px wide bleed color with whatever's next to them (the
  // green backing) across each 2x2 block, drifting some pixels close
  // enough to the key that the alpha ramp below marks them partially or
  // fully transparent instead of ink, or leaves them tinted. A softer
  // per-pixel darken (tried first) still left ambiguous partially-bled
  // pixels reading as translucent/off-color, because it worked WITH the
  // same alpha the bleed already corrupted instead of overriding it. This
  // instead detects unambiguous ink directly on the pre-key pixel —
  // max(r,g,b) below INK_MAX (not average brightness: a dark but saturated
  // color like the maraca prop's red, rgb(196,52,33), has a low average
  // brightness too and was getting caught and blackened by an earlier
  // brightness-based version of this check, which is why this uses max
  // channel instead — true ink's brightest channel still stays well under
  // INK_MAX, unlike a dark saturated color) and not green-ish — and forces
  // it fully opaque, bypassing the alpha ramp and any bleed-corrupted alpha
  // entirely for exactly those pixels. Deliberately does NOT also flatten
  // the color to pure black (an earlier version did, per "the lines are
  // supposed to be full black") — reported straight back as reading too
  // dark/flat next to every other clip on the page, all of which key
  // against black and so show the source ink's own true (dark brown, not
  // literal black) color via the un-premultiply step below. Since these
  // clips are now regenerated from a clean real-alpha master (see the
  // s4-crew-*-green.mp4/bocr-*-loop.mp4 recipes), an unambiguous-ink
  // pixel's own r0/g0/b0 here already IS that same true ink color, unbled —
  // keeping it instead of flattening to black is what actually matches
  // "the rest of them". Everything else (the green background, fur, the
  // party-favor colors) still goes through the normal key/spill logic
  // below untouched.
  //
  // `inkLighten`, when passed, multiplies just this overridden ink color
  // (still clamped to 255) — Princess's own ink read a touch darker than
  // the rest per direct feedback despite averaging almost the same rgb as
  // Milky's; her linework is proportionally thinner/denser on a smaller
  // canvas than the others (more edge-adjacent ink per visible area), which
  // is a framing/coverage difference this function has no way to see, not
  // a wrong color needing a fix here. A small per-character multiplier at
  // her own call site is the targeted knob for that, left off (1, i.e. a
  // no-op) everywhere else.
  const INK_MAX = 95;
  const lighten = inkLighten || 1;
  for (let i = 0; i < data.length; i += 4) {
    const r0 = data[i], g0 = data[i + 1], b0 = data[i + 2];
    if (keyColor) {
      const isGreenish = g0 > r0 + 15 && g0 > b0 + 15;
      if (Math.max(r0, g0, b0) < INK_MAX && !isGreenish) {
        if (lighten !== 1) {
          data[i] = Math.min(255, r0 * lighten);
          data[i + 1] = Math.min(255, g0 * lighten);
          data[i + 2] = Math.min(255, b0 * lighten);
        }
        data[i + 3] = 255;
        continue;
      }
    }
    const r = r0 - kr, g = g0 - kg, b_ = b0 - kb;
    const dist = Math.sqrt(r * r + g * g + b_ * b_);
    let alpha;
    if (dist <= sim) {
      alpha = 0;
    } else if (dist >= sim + b) {
      alpha = 255;
    } else {
      alpha = ((dist - sim) / b) * 255;
    }
    data[i + 3] = alpha;
    // Un-premultiply partially-transparent edge pixels against whatever
    // background color was baked in at encode time (pure black by default,
    // or `keyColor` for the crew's green screen) — an anti-aliased source
    // pixel is a blend of the true drawn color and that background color,
    // the same shape as "color already multiplied by its own alpha", so at
    // partial alpha it's a genuinely DARKER/duller (or, for the crew,
    // green-shifted) version of the true color, not the true color shown
    // faintly. Left alone, compositing that at partial opacity over a page
    // background reads as a muddy ring right at the edge (reported on the
    // candle's fire flame, drawn large enough on screen for what's really
    // just a 1-native-pixel-wide antialiasing band to be visible as a
    // distinct outline). Dividing back out by its own estimated alpha
    // recovers its true color so the edge fades via genuine transparency
    // instead of via darkening/tinting. kr/kg/kb are 0 on every non-crew
    // call site (keyColor omitted), so this reduces to the original
    // divide-by-alpha-against-black for all of them, unchanged.
    if (alpha > 0 && alpha < 255) {
      const af = alpha / 255;
      data[i] = Math.min(255, Math.max(0, (r0 - kr * (1 - af)) / af));
      data[i + 1] = Math.min(255, Math.max(0, (g0 - kg * (1 - af)) / af));
      data[i + 2] = Math.min(255, Math.max(0, (b0 - kb * (1 - af)) / af));
    }
    // Chroma-subsampling spill isn't a clean alpha-over-key blend (the
    // un-premultiply above assumes one), so it isn't fully undone by it.
    // Gated to the partial-alpha ramp only (0<alpha<255) — this used to run
    // unconditionally (every pixel, any alpha), on the reasoning that a
    // spill-tinted edge pixel can still be far enough from pure green to
    // clear sim+blend and read as "fully opaque" despite the tint. That
    // reasoning holds for green specifically because green is far from
    // every character's real colors EXCEPT tan/brown fur, which — reported
    // as "Baby/Princess too dark, Milky too grey" — sits closer to green in
    // plain RGB distance than white or saturated colors do: a genuine
    // interior brown-fur pixel like rgb(139,144,66) measured only ~190 from
    // pure green, barely past this project's own sim+blend=165 threshold
    // and within a few units of a genuinely spill-tinted ink-edge pixel
    // measured earlier (~187) — no per-pixel-only signal (this function has
    // no neighbor/spatial awareness) can tell those two apart by color
    // alone. Unconditional application was therefore clamping G on huge
    // swaths of ordinary opaque fur across every character (confirmed:
    // rgb(213,225,211) white fur silently lost 12 units of G, rgb(186,201,
    // 57) pink fur lost 15), which is a far more visible defect than the
    // narrow "opaque-but-still-a-bit-tinted" edge case this unconditional
    // version was added to catch. Restricting to the partial-alpha ramp is
    // spatially precise instead of color-based — only pixels actually
    // inside the anti-aliased transition can ever have 0<alpha<255, so deep
    // interior fur (always fully opaque by construction) is now completely
    // unreachable here regardless of its color's distance from green, while
    // true edge pixels — the vast majority of them, given how wide this
    // project's own green-key blend already is — still get it.
    if (suppressSpill && alpha > 0 && alpha < 255) {
      if (kg >= kr && kg >= kb) data[i + 1] = Math.min(data[i + 1], Math.max(data[i], data[i + 2]));
      else if (kr >= kg && kr >= kb) data[i] = Math.min(data[i], Math.max(data[i + 1], data[i + 2]));
      else data[i + 2] = Math.min(data[i + 2], Math.max(data[i], data[i + 1]));
    }
  }
}

// Plays `video` and continuously draws it into `canvas`, turning near-black
// pixels transparent (with a soft ramp at the edge so it doesn't look
// jagged). Used for every hand-drawn clip whose source has a black
// background baked in — either from the original footage, or from an
// offline flood-fill pass (see the M2 loop clip below) that turns a
// same-color-as-fur white background into black without touching the
// enclosed, unconnected white fur.
//
// `crop`, if given, is [sx, sy, sw, sh]: a sub-rectangle of the source
// frame to draw instead of the whole thing (used by the section-3 pee
// chain to isolate a narrow vertical band so each tile's canvas doesn't
// carry the frame's own mostly-empty margins).
//
// Returns a stop() function — the requestAnimationFrame loop this starts
// doesn't end on its own just because the source video does (a paused
// video keeps handing back its last decoded frame forever), so any caller
// whose clip isn't meant to loop for the page's whole lifetime needs to
// call stop() once it's done with the canvas, or the keying loop keeps
// re-processing every pixel on every frame indefinitely in the background.
//
// This used to also have a startBlackKeyedGif() sibling for the section-3
// crew characters, which drew from an animated GIF <img> instead of a
// <video> (GIF frames need no play()/readyState handling, since the
// browser advances them on its own). That worked in this session's own
// browser-automation testing, but real-world testing found the GIFs
// simply never animated at all — stuck on frame 1 — even served over
// http:// (so not the file:// canvas-tainting issue below) and even after
// moving the hidden source <img>s out of an overflow:hidden ancestor and
// off a -9999px offset (the working theory at the time: a browser pausing
// GIF frame advancement for images it decides are never actually
// painted). Root cause was never fully confirmed — <video> sidesteps the
// question entirely, since its play() is an explicit, observable API,
// and it's what the rest of this page already uses successfully — so the
// section-3 characters were switched to short muted looping .mp4s
// (transcoded from the same source .gifs with ffmpeg, same black
// background preserved) through this one function instead.
function startBlackKeyedCanvas(video, canvas, crop, blend, keyColor, similarity, inkLighten) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const [sx, sy, sw, sh] = crop || [0, 0, video.videoWidth || w, video.videoHeight || h];

  let stopped = false;

  // some browsers decode a video's first frame without ever actually starting
  // playback unless play() is called explicitly; without this the canvas can
  // end up redrawing that same frame forever, looking like a still image
  function tryPlay() {
    const p = video.play();
    if (p && p.catch) {
      p.catch((err) => {
        console.warn('Video autoplay was blocked, will retry on first interaction:', err);
        const retry = () => { video.play(); document.removeEventListener('pointerdown', retry); };
        document.addEventListener('pointerdown', retry, { once: true });
      });
    }
  }

  // Recovers from a video the browser paused on its own — reported as "the
  // clip sometimes doesn't play": a paused source just keeps handing back
  // its last decoded frame to keyFrame() below forever, so the canvas reads
  // as a frozen still with no error anywhere. These source videos sit at
  // left:-9999px (see .bocr-gif-source) — off-screen on purpose, so the
  // <video> itself is never actually painted, but that's also exactly the
  // condition some browsers use to decide a video is safe to pause and
  // stop decoding to save power (background-tab throttling, OS media-
  // session interruptions, or just deciding an off-screen video doesn't
  // need to keep running) — the same class of "browser silently stops
  // advancing a never-painted media element" bug this function's own gif
  // predecessor hit (see the comment above). tryPlay()'s own promise-
  // rejection handling only covers the very first play() call; this covers
  // every pause after that for the rest of the canvas's lifetime.
  function onPause() {
    if (!stopped) tryPlay();
  }
  video.addEventListener('pause', onPause);

  function keyFrame() {
    if (stopped) return;
    if (video.readyState >= 2) {
      try {
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
        const frame = ctx.getImageData(0, 0, w, h);
        applyBlackKey(frame.data, blend, keyColor, similarity, inkLighten);
        ctx.putImageData(frame, 0, 0);
      } catch (err) {
        console.error('Canvas keying failed (likely a tainted canvas from file:// — serve over http:// instead):', err);
        return;
      }
    }
    requestAnimationFrame(keyFrame);
  }

  tryPlay();
  requestAnimationFrame(keyFrame);

  return function stop() {
    stopped = true;
    video.removeEventListener('pause', onPause);
  };
}

// Header logo clip: shown directly as a plain <video> (mix-blend-mode:
// multiply in CSS drops its white background, no canvas-keying needed),
// so it doesn't go through startBlackKeyedCanvas below like every other
// clip on the page — but it still needs the same explicit play() +
// retry-on-first-interaction fallback those all use (see tryPlay() inside
// startBlackKeyedCanvas), since the plain HTML autoplay attribute alone
// doesn't reliably start playback in every browser.
(function () {
  const logo = document.querySelector('.site-header-logo');
  if (!logo) return;
  function tryPlay() {
    const p = logo.play();
    if (p && p.catch) {
      p.catch(() => {
        const retry = () => { logo.play(); document.removeEventListener('pointerdown', retry); };
        document.addEventListener('pointerdown', retry, { once: true });
      });
    }
  }
  tryPlay();
})();

// Section 1 hero: Milky drops in via hero-m1-start.mp4 the instant the page
// loads, then hands off to his idle loop (hero-m1-loop.mp4) — same intro/
// loop 'ended'-event handoff as the section-2 (M2) and section-3 platform
// patterns elsewhere in this file, just running immediately on load instead
// of gated behind an IntersectionObserver, since the hero is always the
// first thing on screen.
(function () {
  const startVideo = document.getElementById('milky-start-source');
  const startCanvas = document.getElementById('milky-start-canvas');
  const loopVideo = document.getElementById('milky-source');
  const loopCanvas = document.getElementById('milky-canvas');
  if (!loopVideo || !loopCanvas) return;

  // hero-m1-start.mp4 is drawn at its full native 1920x1080 (see
  // .hero-milky-start in style.css for why a tight crop on just his landing
  // spot doesn't work — a landing-poof effect in the clip grows past any
  // crop small enough to be worth it, and got hard-clipped by the crop's
  // own edges). Since the two clips don't share a frame/crop, the handoff
  // below crossfades between the two canvases (both already have an
  // `opacity` transition in CSS) instead of an instant swap.
  //
  // positionHeroStart() solves this canvas's exact width/left/top so that,
  // at the crossfade, Milky's on-screen SIZE and landing POSITION both
  // line up with .hero-milky's own — a first version just eyeballed a
  // `clamp()` width/bottom for this box, which put him at roughly 20% of
  // the frame's own width where the loop draws him at ~72% of its (much
  // smaller) canvas, a real, large scale mismatch no crossfade could hide
  // ("the starting animation's size doesn't match up with the loop's").
  // Fixed by computing this box directly off .hero-milky's own actual
  // rendered size at runtime (so it tracks that element's clamp() exactly,
  // rather than maintaining a second clamp() that can only ever
  // coincidentally match it) using both clips' pixel-scanned character
  // bboxes:
  //   loop clip (bocr... no — hero-m1-loop.mp4, 800x800 native): Milky's
  //   bbox is x64-640/y3-633 -> width fraction 577/800=0.72125, center
  //   fraction (352/800, 318/800) = (0.44, 0.3975).
  //   start clip (hero-m1-start.mp4, 1920x1080 native), his LAST frame:
  //   bbox x792-1170/y558-1009 -> width fraction 378/1920=0.196875,
  //   center fraction (981/1920, 783.5/1080) = (0.510938, 0.725463).
  // Setting `startWidth * 0.196875 = loopWidth * 0.72125` and solving for
  // startWidth gives the SCALE_RATIO below; the two center fractions then
  // place the start canvas's own left/top so that point lands exactly on
  // the loop canvas's own Milky-center point on screen.
  const LOOP_WIDTH_FRAC = 0.72125;
  const START_WIDTH_FRAC = 0.196875;
  const SCALE_RATIO = LOOP_WIDTH_FRAC / START_WIDTH_FRAC; // ~3.6643
  const LOOP_CX_FRAC = 0.44;
  const LOOP_CY_FRAC = 0.3975;
  const START_CX_FRAC = 0.510938;
  const START_CY_FRAC = 0.725463;
  const START_ASPECT = 1080 / 1920;

  function positionHeroStart() {
    const hero = document.querySelector('.hero');
    if (!hero || !startCanvas || !loopCanvas) return;
    const heroRect = hero.getBoundingClientRect();
    const loopRect = loopCanvas.getBoundingClientRect();
    const loopW = loopRect.width;
    if (!loopW) return; // loop canvas not laid out yet (e.g. display:none ancestor)

    const startW = loopW * SCALE_RATIO;
    const startH = startW * START_ASPECT;

    const targetX = (loopRect.left - heroRect.left) + LOOP_CX_FRAC * loopW;
    const targetY = (loopRect.top - heroRect.top) + LOOP_CY_FRAC * loopW;

    startCanvas.style.transform = 'none';
    startCanvas.style.width = startW + 'px';
    startCanvas.style.left = (targetX - START_CX_FRAC * startW) + 'px';
    startCanvas.style.top = (targetY - START_CY_FRAC * startH) + 'px';
  }

  positionHeroStart();
  window.addEventListener('resize', positionHeroStart);

  let stopStartKeying = null;

  function revealLoop() {
    loopCanvas.classList.add('is-visible');
    if (startCanvas) {
      startCanvas.classList.add('is-done');
      // Stop redrawing the start canvas once its own fade-out (0.35s in
      // CSS) has actually finished, not immediately — the canvas needs at
      // least one more frame to fade from, and the video itself has no
      // `loop` attribute so it's just sitting paused on its last frame by
      // now anyway (see the M2 intro/loop handoff above for the same
      // "paused video keeps re-decoding its last frame forever" reasoning
      // — this avoids that wasted redraw loop running for the rest of the
      // page's lifetime, same as that block already does).
      setTimeout(() => { if (stopStartKeying) stopStartKeying(); }, 400);
    }
    startBlackKeyedCanvas(loopVideo, loopCanvas);
  }

  if (!startVideo || !startCanvas) {
    revealLoop();
    return;
  }

  startVideo.addEventListener('ended', () => {
    if (loopVideo.readyState >= 2) {
      revealLoop();
    } else {
      loopVideo.addEventListener('loadeddata', revealLoop, { once: true });
      loopVideo.load();
    }
  });

  stopStartKeying = startBlackKeyedCanvas(startVideo, startCanvas);
})();

// Section 2 (M2): plays the intro clip (Milky getting drawn + dropping in)
// once the stage scrolls into view, then hands off to the looping idle clip.
//
// The intro source's original footage was pure dark ink linework with no
// fill (Milky read as "white" only because he sat on an opaque white/cream
// video — his outline was never actually a closed, filled shape). Playing
// that as a raw opaque <video> also painted its baked-in background wipe
// over the table/platform beneath it despite their higher z-index, and
// keying it transparent naively made Milky himself disappear too, since
// his unfilled interior was pixel-for-pixel the same as the page.
// m2-start-baked.mp4 has since been reprocessed offline (border flood-fill
// with a small gap-sealing dilation, so hairline gaps in the hand-drawn
// outline don't leak the fill) so true background is pure black while
// Milky's ink AND his now-enclosed interior are preserved — the same
// black-keying trick as the loop clip below turns that into a transparent
// overlay with a solid white Milky, safe to sit in front of the table for
// the whole clip. The actual background color comes from --s2-color, a
// plain CSS crossfade instead of baked-in video pixels.
(function () {
  const section = document.getElementById('section-2');
  const stage = document.getElementById('m2-stage');
  const introVideo = document.getElementById('m2-video-source');
  const introCanvas = document.getElementById('m2-video-canvas');
  const loopVideo = document.getElementById('m2-loop-source');
  const loopCanvas = document.getElementById('m2-loop-canvas');
  if (!section || !stage || !introVideo || !introCanvas || !loopVideo || !loopCanvas) return;

  let started = false;
  let stopIntroKeying = null;

  function playIntro() {
    if (started) return;
    started = true;
    stopIntroKeying = startBlackKeyedCanvas(introVideo, introCanvas);
  }

  function revealLoop() {
    // The intro clip already ends on its own settle/pop motion, so
    // animating a second drop here read as dropping twice — instead just
    // place him directly at his resting spot on the table, instantly.
    introCanvas.style.display = 'none';
    // The intro clip doesn't loop, so its keying loop never stops on its
    // own (a paused video keeps re-decoding its last frame forever) —
    // without this it would keep redrawing/re-keying the full-res intro
    // canvas every frame right alongside the loop canvas below, for good.
    if (stopIntroKeying) stopIntroKeying();
    loopCanvas.classList.add('is-visible');
    startBlackKeyedCanvas(loopVideo, loopCanvas);

    // the green-to-white gradient (and the buffer/stage resting color)
    // only switches to the clip's cream once that color has actually
    // appeared on screen, instead of showing up before the animation gets there
    section.style.setProperty('--s2-color', '#fdedcb');

    // "Started as one silly animation..." used to be on the generic
    // scroll-triggered .reveal-text observer below, same as every other
    // section's copy — but that let it appear as soon as it scrolled into
    // view, which could land during (or even before) Milky's own draw-in,
    // competing with it instead of following it. Reveals in the same place
    // .is-warm/--s2-color do, right when the loop clip actually takes over,
    // so the text only ever appears once his entrance is finished. See the
    // ':not(.s2-intro-text)' exclusion on the generic observer's own query.
    const introText = document.querySelector('.s2-intro-text');
    if (introText) introText.classList.add('is-revealed');
  }

  introVideo.addEventListener('ended', () => {
    // Wait until the loop clip actually has a decoded frame ready before
    // swapping to it — revealing the canvas before that leaves it blank
    // for a beat (nothing decoded yet), which showed up as a flicker
    // between the intro ending and the loop appearing.
    if (loopVideo.readyState >= 2) {
      revealLoop();
    } else {
      loopVideo.addEventListener('loadeddata', revealLoop, { once: true });
      loopVideo.load();
    }
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        playIntro();
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });

  observer.observe(stage);
})();

// Section 2 items/bear: each fades and rises into place the moment the
// viewer scrolls near it, rather than sitting fully visible from the
// instant the (much taller) stage first appears. m2-platform is
// deliberately excluded — it's always visible with no reveal transition
// (per request), unlike the items/bear which keep the fade+rise treatment.
// Each element gets its own observer instead of one shared one so they
// reveal independently as the scroll position actually reaches each.
(function () {
  const targets = [
    'm2-desktop-nailclipper', 'm2-desktop-nailpolish', 'm2-desktop-toothbrush', 'm2-teddy-bear',
    'm2-mobile-nailpolish', 'm2-mobile-nailclipper', 'm2-mobile-teddybear', 'm2-mobile-toothbrush',
  ]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!targets.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -12% 0px' });

  targets.forEach((el) => observer.observe(el));
})();

// Section 2 grooming items (nail polish, nail clipper, toothbrush — both
// the mobile floating props and their desktop .m2-groom-cluster
// equivalents, see index.html/style.css) are tappable/clickable: a
// tap/click/Enter/Space plays the .is-tapped "pop" animation (m2-tap-pop
// in style.css) once, then it falls back to the item's own continuous
// idle wobble (m2-idle-item). The bear is deliberately not included here —
// only the 3 actual grooming items are interactive, per request.
//
// Toggling the class off then back on (rather than just adding it once)
// is what lets the same animation replay on a second tap before the first
// play would have finished on its own — without the forced reflow between
// remove and add, the browser can coalesce the two class changes into one
// style recalc and never notice the animation was meant to restart.
(function () {
  const items = Array.from(document.querySelectorAll('.m2-tappable'));
  if (!items.length) return;

  const TAP_DURATION_MS = 550; // matches m2-tap-pop's own animation-duration

  function playTap(el) {
    el.classList.remove('is-tapped');
    void el.offsetWidth; // force a reflow so re-adding the class below actually restarts the animation
    el.classList.add('is-tapped');
    clearTimeout(el._m2TapTimer);
    el._m2TapTimer = setTimeout(() => el.classList.remove('is-tapped'), TAP_DURATION_MS);
  }

  items.forEach((el) => {
    el.addEventListener('click', () => playTap(el));
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      playTap(el);
    });
  });
})();

// Generic scroll-reveal for the section copy blocks added in index.html
// (Brand Intro, Best-of Content Reel plaque, Meet the Crew heading, Social
// Proof intro) — same fade+rise-into-place idea as the m2-reveal targets
// just above, generalized via a shared class so any section's text can opt
// in with one class instead of a bespoke observer per block.
// .s2-intro-text excluded on purpose: it still uses the shared .reveal-text
// CSS (opacity/transition/is-revealed), just not this generic scroll
// trigger — see revealLoop() in the M2 intro/loop block above, which reveals
// it once Milky's own draw-in animation actually finishes instead.
(function () {
  const targets = Array.from(document.querySelectorAll('.reveal-text:not(.s2-intro-text)'));
  if (!targets.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });

  targets.forEach((el) => observer.observe(el));
})();

// Below-the-fold video preloading: every clip below the hero used to ship
// preload="auto", telling the browser to start downloading essentially the
// whole site's worth of video (many MB) immediately on page load, before a
// visitor had scrolled anywhere — a slow, possibly expensive first
// impression on cellular data for content most people won't even reach
// right away. Those clips now ship preload="metadata" in index.html
// instead (fetch just enough to know duration/dimensions, not the full
// file), and this observer upgrades each one back to preload="auto" (then
// calls .load() to actually kick off the fetch under the new setting) once
// its own section is getting close to the viewport — same
// IntersectionObserver-driven pattern as the scroll-reveal text above, just
// with a large positive bottom rootMargin so buffering has a head start
// well before the section (and whatever scroll- or click-triggered play()
// call actually needs the frames) arrives on screen, rather than only
// starting once already in view. The hero's own clip is intentionally left
// alone — it's visible immediately, so it keeps its original preload="auto".
(function () {
  const groups = [
    { section: '#section-2', videos: ['#m2-video-source', '#m2-loop-source'] },
    { section: '#section-3', videos: [
      '#bocr-milky-intro-source', '#bocr-milky-loop-source', '#bocr-milky-pee-source',
      '#bocr-baby-loop-source', '#bocr-princess-loop-source', '#bocr-milky-walk-source',
    ] },
    { section: '#section-4', videos: ['#candle-spark-source', '#candle-fire-source'] },
  ];

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      (entry.target._lazyVideos || []).forEach((v) => {
        v.preload = 'auto';
        v.load();
      });
    });
  }, { rootMargin: '0px 0px 800px 0px' });

  groups.forEach((g) => {
    const section = document.querySelector(g.section);
    if (!section) return;
    const videos = g.videos.map((sel) => document.querySelector(sel)).filter(Boolean);
    if (!videos.length) return;
    section._lazyVideos = videos;
    observer.observe(section);
  });
})();

// Section 3 (Best-of Content Reel): redirects the mouse wheel to horizontal
// scrolling while the cursor is over the gallery window, so panning through
// the reel never scrolls the page itself. Only bound on this element, so
// wheel behavior everywhere else on the page is untouched.
// Once the reel is fully panned in the scroll direction (at its start/end),
// the wheel event is left alone so it falls through to normal page scroll
// instead of trapping the cursor in a dead zone.
(function () {
  const viewport = document.getElementById('bocr-viewport');
  if (!viewport) return;

  viewport.addEventListener('wheel', (e) => {
    if (e.deltaY === 0) return;
    const atStart = viewport.scrollLeft <= 0;
    const atEnd = viewport.scrollLeft >= viewport.scrollWidth - viewport.clientWidth - 1;
    if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
    e.preventDefault();
    viewport.scrollLeft += e.deltaY;
  }, { passive: false });
})();

// Section 3 gallery: real click-and-drag panning, matching the `cursor: grab`
// the viewport already advertises in CSS (it previously had no drag handler
// at all — only the wheel redirect above and the native scrollbar could pan
// it). Tracks pointer delta from mousedown and applies it to scrollLeft;
// treated as a click (not a drag) if the pointer barely moved, so tappable
// elements inside the reel still work normally.
(function () {
  const viewport = document.getElementById('bocr-viewport');
  if (!viewport) return;

  let isDown = false;
  let didDrag = false;
  let startX = 0;
  let startScrollLeft = 0;

  viewport.addEventListener('mousedown', (e) => {
    isDown = true;
    didDrag = false;
    startX = e.clientX;
    startScrollLeft = viewport.scrollLeft;
    viewport.classList.add('is-grabbing');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const delta = e.clientX - startX;
    if (Math.abs(delta) > 3) didDrag = true;
    viewport.scrollLeft = startScrollLeft - delta;
  });

  window.addEventListener('mouseup', () => {
    if (!isDown) return;
    isDown = false;
    viewport.classList.remove('is-grabbing');
  });

  // Suppress the click that follows a real drag, so dragging across a link
  // or button inside the reel doesn't also fire its click action.
  viewport.addEventListener('click', (e) => {
    if (didDrag) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
})();

// Section 3 museum: best-of reel spotlights (.bocr-spotlight, see
// style.css). Each one fades in once panned into view — IntersectionObserver
// with the default root (the page viewport) still correctly accounts for
// .bocr-viewport's own horizontal overflow-x:auto clipping on top of normal
// page scroll, so this fires whether the visitor scrolled the page or
// dragged/panned the gallery. Fill in/replace any spotlight's `data-url` in
// index.html with a real post URL — TikTok is the platform-agnostic default
// (renders natively, no login wall); Baby/Princess spotlights (or anything
// IG-only) should carry data-platform="instagram" the way the current 6 do.
//
// 2026-09-15: the real TikTok/Instagram embeds used to lazy-load through
// this same observer (gated behind isIntersecting, same as the fade-in),
// specifically so all 6 weren't loading their iframes up front. Per a
// report that a reel visibly sits as a blank black box until you actually
// scroll/pan it into view — real embeds take a beat to fetch and render,
// and rootMargin's 600px head-start isn't enough of one for a cross-origin
// iframe load — embed loading is now unconditional and fires for all 6
// immediately below (PRELOAD_DELAY_MS after load, not synchronously in the
// middle of the initial page render). isIntersecting now only gates the
// is-active fade-in class, same visual reveal as before, decoupled from
// loading.
(function () {
  const spotlights = document.querySelectorAll('.bocr-spotlight');
  if (!spotlights.length) return;

  function extractTikTokId(url) {
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : '';
  }

  function loadTikTok(container, url) {
    const videoId = extractTikTokId(url);
    container.innerHTML =
      `<blockquote class="tiktok-embed" cite="${url}" data-video-id="${videoId}" style="max-width:100%;min-width:100%;">` +
      `<section></section></blockquote>`;
    // Re-runs embed.js's own DOM scan — safe to call repeatedly, the browser
    // caches the file after the first spotlight loads it.
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.tiktok.com/embed.js';
    document.body.appendChild(script);
  }

  function loadInstagram(container, url) {
    container.innerHTML =
      `<blockquote class="instagram-media" data-instgrm-permalink="${url}" style="margin:0;width:100%;">` +
      `<a href="${url}" target="_blank" rel="noopener">View on Instagram</a></blockquote>`;
    if (window.instgrm && window.instgrm.Embeds) {
      window.instgrm.Embeds.process();
    } else {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.instagram.com/embed.js';
      document.body.appendChild(script);
    }
  }

  // The real iframe Instagram/TikTok's script drops in only lays out
  // correctly at (or above) a platform-enforced minimum width — nowhere
  // near this frame's own small size (clamp(112px, 4.2%, 190px), see
  // style.css). Resizing the iframe ELEMENT itself via CSS doesn't shrink
  // what renders inside it, it just gives a smaller viewport onto the same
  // full-size layout (reported: "only a tiny corner of the video is
  // visible"). So the iframe is left at whatever size the embed script
  // actually gave it, and transform:scale shrinks the whole rendered thing
  // down as one unit instead.
  //
  // Both platforms' embed cards stack header (profile pic/username) + video
  // + "View more on Instagram"/caption line + footer (like/comment/share
  // icons, like count, add-a-comment box) — chrome that doesn't belong on
  // a "framed reel" hung on the museum wall, and per a follow-up request
  // should be cropped down to just the video + that one caption-link line,
  // dropping the icon row and everything below it.
  //
  // The card is cross-origin, so there's no reaching in to measure any of
  // this directly. HEADER_OFFSET_PX is a visual estimate of the header's
  // own height at the card's natural (unscaled) size, used to shift the
  // whole card up so the video's own top — not the header's — lands at the
  // frame's top. FOOTER_CHROME_PX is a *separate* estimate of just the
  // icon-row-and-below chunk's own height. An earlier version assumed the
  // video itself is always 9:16 and let a fixed-aspect-ratio frame crop
  // the footer off "for free" once the video's width matched the frame's
  // — that broke on any post whose video ISN'T 9:16 (a square post left a
  // gap below the video that the footer then bled into, screenshotted:
  // the icon row/likes/comment box were all still showing). Subtracting a
  // fixed footer height from the card's own ACTUAL measured total height
  // (iframe.offsetHeight — the one dimension of a cross-origin iframe that
  // IS readable, and the embed script keeps it in sync with the real
  // content) adapts to whatever the video's real aspect ratio turns out to
  // be instead of assuming one, since whatever's left over after removing
  // the two roughly-constant chrome chunks (header, footer) is exactly
  // "however tall this specific post's video actually is" — no need to
  // know that number in advance. Both constants are tuned by eye against
  // one real embed; nudge them if either platform's layout drifts from
  // this estimate.
  const HEADER_OFFSET_PX = { instagram: 58, tiktok: 66 };
  const FOOTER_CHROME_PX = { instagram: 165, tiktok: 150 };

  // Some posts' own media doesn't span the card's full width — Instagram/
  // TikTok pillarbox it (black bars left/right) instead of stretching it,
  // same idea as the header/footer chrome above but horizontal, and worse:
  // unlike the header/footer (roughly constant chrome regardless of the
  // post), bar width depends on that specific media's own aspect ratio,
  // which isn't reflected in any dimension we can actually read off a
  // cross-origin iframe (offsetWidth stays the card's fixed width either
  // way) the way offsetHeight happens to reveal the footer crop above. So
  // this can't be measured/derived automatically — it's an explicit
  // opt-in per spotlight instead: set data-zoom (e.g. "1.45") on a
  // .bocr-spotlight-embed in index.html to zoom in by that extra factor,
  // centered horizontally, cropping equal amounts off both bars. Left at
  // 1 (no extra crop) by default since most posts don't have this problem
  // at all, and zooming a post that doesn't need it just crops into real
  // content instead of a bar.
  function fitEmbedIframe(container, iframe, platform) {
    const naturalWidth = iframe.offsetWidth;
    const naturalHeight = iframe.offsetHeight;
    if (!naturalWidth || !naturalHeight) return; // not laid out yet — the next resize fires once it is
    const containerWidth = container.clientWidth;
    const extraZoom = parseFloat(container.dataset.zoom) || 1;
    const scale = (containerWidth / naturalWidth) * extraZoom;
    const headerOffset = HEADER_OFFSET_PX[platform];
    const footerChrome = FOOTER_CHROME_PX[platform];
    const keptNaturalHeight = Math.max(60, naturalHeight - headerOffset - footerChrome);
    // transform-origin stays top-left (0,0 in the iframe's own local space);
    // translateX re-centers the now-wider-than-frame zoomed result instead
    // of leaving it pinned to the left edge, so extraZoom crops evenly off
    // both sides rather than eating the right bar twice over while leaving
    // the left one untouched.
    const translateX = (containerWidth * (1 - extraZoom)) / 2;
    const translateY = -headerOffset * scale;
    iframe.style.transformOrigin = 'top left';
    iframe.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    container.style.height = (keptNaturalHeight * scale) + 'px';
  }

  function watchEmbedIframe(container, platform) {
    const mutationObserver = new MutationObserver(() => {
      const iframe = container.querySelector('iframe');
      if (!iframe) return;
      mutationObserver.disconnect();
      const resizeObserver = new ResizeObserver(() => fitEmbedIframe(container, iframe, platform));
      resizeObserver.observe(iframe);
    });
    mutationObserver.observe(container, { childList: true, subtree: true });
  }

  function loadSpotlightEmbed(container) {
    const platform = container.dataset.platform === 'instagram' ? 'instagram' : 'tiktok';
    const url = container.dataset.url;
    if (!url || url.startsWith('TODO_')) {
      container.innerHTML = '<p class="bocr-spotlight-placeholder">reel coming soon</p>';
      return;
    }
    watchEmbedIframe(container, platform);
    if (platform === 'instagram') loadInstagram(container, url);
    else loadTikTok(container, url);
  }

  const spotlightObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-active');
      spotlightObserver.unobserve(entry.target);
    });
  }, {
    threshold: 0.4,
    rootMargin: '600px',
  });

  spotlights.forEach((el) => spotlightObserver.observe(el));

  // Loads every embed up front instead of waiting on scroll/pan, per the
  // "reels sit blank until you scroll to them" report. Deferred slightly
  // (rather than firing inline during the initial script run) so 6
  // simultaneous cross-origin iframe loads don't compete with the page's
  // own first paint/hero animation for bandwidth and main-thread time; the
  // delay is a small head start for the page itself, not a meaningful wait
  // from a visitor's perspective — by the time anyone scrolls this far
  // down the page, every embed has had a full page-load's worth of time to
  // finish fetching.
  const PRELOAD_DELAY_MS = 300;
  setTimeout(() => {
    spotlights.forEach((el) => {
      const embedEl = el.querySelector('.bocr-spotlight-embed');
      if (embedEl && !embedEl.dataset.loaded) {
        embedEl.dataset.loaded = 'true';
        loadSpotlightEmbed(embedEl);
      }
    });
  }, PRELOAD_DELAY_MS);
})();

// Section 3 cloud frame: sizes .bocr-cloud off .bocr-frame's actual
// rendered box instead of a single fixed CSS percentage. .bocr-frame's own
// aspect ratio swings a lot between mobile (narrow, but tall because
// .bocr-viewport's clamp() height floor barely shrinks) and desktop (wide,
// short) — a width-based percentage overhangs the top/bottom on desktop
// but not mobile, a height-based one overhangs the sides on mobile but not
// desktop. Picking whichever of a width-driven or height-driven size is
// bigger (scaled uniformly, so the smaller constraint is still satisfied
// too) guarantees the cloud overhangs on all 4 sides at any frame shape.
(function () {
  const cloud = document.querySelector('.bocr-cloud');
  const frame = document.querySelector('.bocr-frame');
  if (!cloud || !frame) return;

  const ASPECT = 1098 / 727; // .bocr-cloud's own natural width / height
  const WIDTH_FACTOR = 1.3;  // overhang at least 30% past the frame's width
  const HEIGHT_FACTOR = 1.45; // ...and at least 45% past its height

  function sizeCloudFrame() {
    const w = frame.offsetWidth;
    const h = frame.offsetHeight;
    if (!w || !h) return;
    const widthFromWidth = w * WIDTH_FACTOR;
    const widthFromHeight = h * HEIGHT_FACTOR * ASPECT;
    cloud.style.width = Math.max(widthFromWidth, widthFromHeight) + 'px';
    cloud.style.height = 'auto';
  }

  sizeCloudFrame();
  window.addEventListener('resize', sizeCloudFrame);
  window.addEventListener('load', sizeCloudFrame);
})();

// Museum walker (Milky) size: tied to #bocr-viewport's own actual rendered
// height instead of an independent vw clamp — see .bocr-museum-walker's own
// comment in style.css for why ("museum looks too small, Milky looks too
// big" at screen sizes between the viewport's and the walker's own
// separately-tuned breakpoints). RATIO is exactly the old desktop clamp's
// own ceiling-over-ceiling ratio (130px walker / 556px viewport, both the
// values that formula settled on at this project's 1920px reference), so
// this reproduces the original desktop sizing at that reference width
// (556 * 0.2338 = 130) while staying in proportion at every other width
// too, mobile included — the mobile viewport is now much taller (see
// .bocr-viewport's mobile clamp in style.css), so this scales him up right
// along with it instead of needing its own separately-tuned mobile ratio.
(function () {
  const walker = document.querySelector('.bocr-museum-walker');
  const viewport = document.getElementById('bocr-viewport');
  if (!walker || !viewport) return;

  const RATIO = 0.2338;
  const MIN_WIDTH = 60;
  const MAX_WIDTH = 200;

  function sizeWalker() {
    const h = viewport.offsetHeight;
    if (!h) return;
    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, h * RATIO));
    walker.style.width = width + 'px';
  }

  sizeWalker();
  window.addEventListener('resize', sizeWalker);
  window.addEventListener('load', sizeWalker);
})();

// Section 3 museum: Milky walks left-to-right across the museum floor —
// from bocr-milky-walk.mp4 (a cropped run-cycle loop transcoded from "3
// BOCR - M1.mov" in assets/Homepage, see .bocr-museum-walker's own comment
// in style.css for the crop recipe). His horizontal POSITION is driven
// purely by how far .bocr-frame itself has scrolled through the viewport
// (0 the instant its top edge enters at the viewport's bottom, 1 the
// instant its bottom edge leaves at the viewport's top) — same "how far
// through has this element scrolled" idea as the section-4 is-ending fade
// above, just driving a continuous position instead of a boolean. His WALK
// CYCLE (whether the run-cycle canvas is actually animating vs. frozen
// mid-stride) is a separate concern, and per request now runs on a
// DIFFERENT trigger than position does: only scrolling/panning the
// museum's own gallery strip (#bocr-viewport, "the inside of the museum")
// starts/keeps him walking — plain outer-page scroll still repositions him
// (the museum frame moving through the viewport) but no longer wakes the
// walk cycle on its own. See ensureWalking/onGalleryScroll below. Both
// listeners only run while the frame is actually intersecting (see the
// IntersectionObserver below), same reasoning as the candle-follow block:
// no point recalculating this for the rest of the page's lifetime.
(function () {
  const frame = document.querySelector('.bocr-frame');
  const walker = document.getElementById('bocr-museum-walker');
  const canvas = document.getElementById('bocr-milky-walk-canvas');
  const video = document.getElementById('bocr-milky-walk-source');
  if (!frame || !walker || !canvas || !video) return;

  let started = false;
  let ticking = false;
  // Which way he's currently facing: 1 = normal (as drawn, walking toward
  // +X), -1 = mirrored via scaleX. Compared against a reference progress
  // that only itself updates once the scroll has moved more than
  // MIN_PROGRESS_DELTA — a bare `progress !== lastProgress` check (a first
  // attempt) re-evaluated direction on every single sub-pixel scroll
  // fluctuation, which reads as smooth scrolling to a person but is not
  // perfectly monotonic frame-to-frame (trackpad/OS scroll easing, rAF
  // timing jitter) — enough to flip `facing` back and forth rapidly and
  // make him appear to hop left/right instead of walking one direction.
  // The threshold makes a flip require *real*, sustained reverse motion.
  let facing = 1;
  let lastProgress = null;
  const MIN_PROGRESS_DELTA = 0.0025;
  // "Only walk while actually scrolling": rather than pausing/resuming the
  // <video> itself on a scroll-idle timer (the first version of this did
  // that, and calling play()/pause() back-to-back in quick succession
  // during a bursty real scroll gesture raced their promises — an
  // interrupted play() throws, which is silently swallowed, and can leave
  // the video stuck paused indefinitely, reading as "sometimes the
  // animation doesn't play"), the video is left playing continuously once
  // started and this instead stops/restarts the *canvas's own redraw loop*
  // (startBlackKeyedCanvas's returned stop() function) — no play()/pause()
  // calls after the first one, so there's nothing left to race. Freezing
  // the redraw (not the video) still reads as him stopping mid-stride;
  // the video simply keeps looping unseen underneath while idle, so
  // resuming redraws just picks up wherever the loop currently is.
  let stopKeying = null;
  let idleTimer = null;
  const IDLE_MS = 400;

  function ensureWalking() {
    if (!stopKeying) stopKeying = startBlackKeyedCanvas(video, canvas);
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (stopKeying) { stopKeying(); stopKeying = null; }
    }, IDLE_MS);
  }

  function update() {
    ticking = false;
    const rect = frame.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height)));
    const maxX = Math.max(0, rect.width - walker.offsetWidth);
    if (lastProgress === null) {
      lastProgress = progress;
    } else if (Math.abs(progress - lastProgress) >= MIN_PROGRESS_DELTA) {
      facing = progress >= lastProgress ? 1 : -1;
      lastProgress = progress;
    }
    // Repositions him only — per request ("only walks when you are
    // scrolling the INSIDE of the museum"), outer-page scroll no longer
    // triggers the walk cycle at all, just keeps his X position/facing in
    // sync with how far the page has scrolled through .bocr-frame. Only
    // onGalleryScroll (panning the gallery strip itself) calls
    // ensureWalking() now.
    walker.style.transform = `translateX(${(progress * maxX).toFixed(1)}px) scaleX(${facing})`;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  // The museum gallery strip itself (#bocr-viewport) is independently
  // horizontally-scrollable (mouse wheel over it pans the gallery instead
  // of the page — see its own wheel-redirect block above): panning it
  // never fires a 'scroll' event on `window` at all, only on the viewport
  // element itself, AND never changes .bocr-frame's own position (so
  // `progress` above never moves either). Two separate real bugs, both
  // reported live: (1) without listening here too, panning the gallery
  // left him completely frozen ("scrolling the page" walked him,
  // "scrolling the museum" didn't); (2) `facing` was only ever derived from
  // outer-page `progress`, so scrolling back and forth *inside the gallery*
  // could never flip him at all, no matter how deliberately — there was
  // simply no outer-progress change for the direction logic to see. Fixed
  // by tracking the gallery's own `scrollLeft` independently, with the same
  // hysteresis-threshold approach as the outer-progress version above, so
  // panning it left/right drives `facing` on its own terms — this can only
  // ever run while `progress` itself hasn't changed (the gallery's own
  // scroll doesn't touch page scroll), so it can never fight the
  // outer-progress branch in update() above.
  const galleryViewport = document.getElementById('bocr-viewport');
  let lastGalleryScrollLeft = null;
  const MIN_GALLERY_DELTA = 2;

  function onGalleryScroll() {
    if (galleryViewport) {
      const sl = galleryViewport.scrollLeft;
      if (lastGalleryScrollLeft === null) {
        lastGalleryScrollLeft = sl;
      } else if (Math.abs(sl - lastGalleryScrollLeft) >= MIN_GALLERY_DELTA) {
        facing = sl >= lastGalleryScrollLeft ? 1 : -1;
        lastGalleryScrollLeft = sl;
      }
    }
    onScroll();
    // The one and only place that starts/keeps the walk cycle going now —
    // panning the gallery strip is "scrolling the inside of the museum"
    // per the request this replaced the old (outer-scroll-triggered)
    // behavior with.
    ensureWalking();
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        started = true;
        window.addEventListener('scroll', onScroll, { passive: true });
        if (galleryViewport) galleryViewport.addEventListener('scroll', onGalleryScroll, { passive: true });
        update();
        // Draws his first frame (and briefly settles/freezes via
        // ensureWalking's own idle timer) the moment the museum scrolls
        // into view, so he's visible immediately rather than staying an
        // undrawn blank canvas until the visitor happens to pan the
        // gallery — this one call is a reveal, not an ongoing "outer
        // scroll walks him" trigger (see update() above, which no longer
        // calls ensureWalking at all).
        ensureWalking();
      } else {
        window.removeEventListener('scroll', onScroll);
        if (galleryViewport) galleryViewport.removeEventListener('scroll', onGalleryScroll);
        if (idleTimer) clearTimeout(idleTimer);
        if (stopKeying) { stopKeying(); stopKeying = null; }
        if (started) video.pause();
      }
    });
  }, { threshold: 0 });

  observer.observe(frame);
})();

// Section 3 platforms: Milky drops in via bocr-milky-intro.mp4 the moment
// the platforms scroll into view, then hands off to bocr-milky-loop.mp4
// (his idle loop, which already includes him periodically peeing) —
// same intro/loop 'ended'-event handoff as the section-2 pattern above.
// 2026-09-13: the loop clip is now green-composited from the real
// per-character alpha master and keyed with CREW_GREEN_* (see that
// constant's own comment) instead of CREW_KEY_BLEND — the intro clip
// still uses the old black-key path since it's sourced from its own
// separate (untouched) low-res GIF, not the alpha master.
(function () {
  const platforms = document.getElementById('bocr-platforms');
  const introVideo = document.getElementById('bocr-milky-intro-source');
  const introCanvas = document.getElementById('bocr-milky-intro-canvas');
  const loopVideo = document.getElementById('bocr-milky-loop-source');
  const loopCanvas = document.getElementById('bocr-milky-loop-canvas');
  if (!platforms || !introVideo || !introCanvas || !loopVideo || !loopCanvas) return;

  let started = false;
  let stopIntroKeying = null;

  function playIntro() {
    if (started) return;
    started = true;
    stopIntroKeying = startBlackKeyedCanvas(introVideo, introCanvas, null, CREW_KEY_BLEND);
  }

  function revealLoop() {
    introCanvas.style.display = 'none';
    if (stopIntroKeying) stopIntroKeying();
    loopCanvas.classList.add('is-visible');
    startBlackKeyedCanvas(loopVideo, loopCanvas, null, MILKY_GREEN_BLEND, CREW_GREEN, CREW_GREEN_SIMILARITY);
  }

  introVideo.addEventListener('ended', () => {
    if (loopVideo.readyState >= 2) {
      revealLoop();
    } else {
      loopVideo.addEventListener('loadeddata', revealLoop, { once: true });
      loopVideo.load();
    }
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        playIntro();
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });

  observer.observe(platforms);
})();

// Section 3 platforms: Baby and Princess are ambient idle loops, each
// starting the moment its own spot actually scrolls into view (independent
// observers, so they start on their own real timing rather than both
// firing together whenever the much taller platforms container appears) —
// same reveal-on-scroll idea as the section-2 table/items/bear above.
// 2026-09-13: both clips green-composited from their real alpha masters
// and keyed with CREW_GREEN_* now, same reasoning/history as Milky's own
// loop above.
(function () {
  const characters = [
    {
      target: document.querySelector('.bocr-baby-platform'),
      video: document.getElementById('bocr-baby-loop-source'),
      canvas: document.getElementById('bocr-baby-loop-canvas'),
    },
    {
      target: document.querySelector('.bocr-river-wrap'),
      video: document.getElementById('bocr-princess-loop-source'),
      canvas: document.getElementById('bocr-princess-loop-canvas'),
      // Her own ink read a touch darker than Milky's/Baby's despite a
      // near-identical measured average — see applyBlackKey's own
      // inkLighten comment. 1.12 picked by rendering candidate composites
      // and reading them, same as every other blend/darken value on this
      // page — a "slight" nudge per the request, not a full re-match.
      inkLighten: 1.12,
    },
  ].filter((c) => c.target && c.video && c.canvas);
  if (!characters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const character = characters.find((c) => c.target === entry.target);
      if (!character) return;
      startBlackKeyedCanvas(character.video, character.canvas, null, CREW_GREEN_BLEND, CREW_GREEN, CREW_GREEN_SIMILARITY, character.inkLighten);
      character.canvas.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.2 });

  characters.forEach((c) => observer.observe(c.target));
})();

// Section 3 platforms: chains copies of bocr-milky-pee.mp4 (Milky's
// stream, isolated from his body) end-to-end to carry it down past the
// baby platform and into the river. Milky's loop canvas and the river art
// live in different flow contexts — one inside .bocr-platforms, one after
// it — so no fixed CSS length can bridge them; this measures the real gap
// with getBoundingClientRect and fills it with just enough tiles,
// re-measuring on resize the same way .bocr-cloud sizes itself above.
// Every tile draws the same shared <video>, so they all show the
// identical current frame — the stream doesn't animate "downward" between
// tiles, it pulses on/off in lockstep the way the source clip itself does.
(function () {
  const milkySpot = document.querySelector('.bocr-milky-spot');
  const milkyCanvas = document.getElementById('bocr-milky-loop-canvas');
  const chain = document.getElementById('bocr-pee-chain');
  const peeVideo = document.getElementById('bocr-milky-pee-source');
  const riverWrap = document.querySelector('.bocr-river-wrap');
  if (!milkySpot || !milkyCanvas || !chain || !peeVideo || !riverWrap) return;

  // Crop of bocr-milky-pee.mp4's 852x480 frame down to just the stream
  // itself, which sits in a narrow vertical band around x=460-550. The
  // drawn stream never actually reaches the frame's own top/bottom edges,
  // and — this is the part that made earlier passes at this still show an
  // occasional gap — exactly how far it reaches *wobbles frame to frame*
  // (the clip's 7 kept frames pixel-scanned individually: top edge
  // anywhere from y29-34, bottom edge alternating y456/y462 depending on
  // the A/B phase). Since every tile in the chain draws whatever frame is
  // currently playing, a crop sized to any single frame's extent (or an
  // average/padded guess) leaves a blank sliver at every seam on whichever
  // *other* frames fall short of that window. The fix is to crop to the
  // intersection that's guaranteed present in EVERY kept frame — y34
  // (the latest of all 7 frames' top edges) to y456 (the earliest of all
  // 7 frames' bottom edges) — so every tile is fully solid top-to-bottom
  // on every single frame of the loop, no exceptions. This does mean the
  // stream's own subtle "breathing" (a few px longer on A frames) no
  // longer shows at the very ends, but that's the trade needed for a
  // seam that never gaps. Source clip is also pre-trimmed to just its 7
  // "stream visible" frames (see bocr-milky-pee.mp4's own recipe) instead
  // of the original 21-frame loop, which spent 14 of those frames fully
  // blank (Milky's isolated peeing cycle) — on the shared <video>, that
  // made every tile in the chain vanish in sync for most of each loop.
  // The 7 kept frames alternate A,B,A,B,A,B,A, so frame 6 looping back to
  // frame 0 is already a same-to-same, seamless cut.
  const CROP = [460, 34, 90, 423];
  // 2026-09-07: re-measured from scratch after bocr-milky-loop.mp4 was
  // swapped to a completely different source (see the big comment on
  // .bocr-milky-loop-canvas in style.css) — the clip this was originally
  // measured against was a loosely-padded shared 852x480 frame; the new
  // one is a tight 700x978 portrait crop of a different pose entirely, so
  // the old fractions (measured against landmarks that don't exist in the
  // same place, or in the same frame, anymore) were pointing the chain at
  // the wrong spot on the new art. This is what actually caused the
  // reported "yellow line is broken/misaligned" — the chain wasn't
  // literally crooked, it was anchored to a stale exit point, and (see
  // STREAM_WIDTH_FRACTION below) rendered too thin to read as a solid
  // stream once it was there.
  //
  // Where the stream leaves Milky's body, as a fraction of his own
  // canvas's own native width/height (700x978) — NOT the pee clip's own
  // 852x480 frame, a different source with no shared pixel scale.
  // Black-key bbox-scanned every one of the new clip's 32 frames (raw
  // rgb24 dump, same technique as every other landmark measurement in
  // this file): his own drawn stream tip alternates between two phases
  // (a wobble, same "A/B" pattern this project's other clips all have),
  // bottoming out at y902 (shortest reach, guaranteed-safe/no-gap
  // approach — same reasoning as the old EXIT_Y_FRACTION derivation) and
  // 923 (longest). Sampled x at the shared row y902 across every frame:
  // alternates 606 (the actual thin stream tip) / 607.5 (his leg, a few
  // frames where the tip has already receded past this row) — close
  // enough to treat as one point, used the stream's own value (606).
  const EXIT_X_FRACTION = 606 / 700;
  const EXIT_Y_FRACTION = 902 / 978;
  // The old `width = milkyRect.width * (CROP[2] / 852)` formula's "/852"
  // only made sense when Milky's own canvas shared the pee clip's 852-wide
  // native frame (both cropped from the same loosely-padded shared-world
  // convention) — dividing by 852 converted "the pee crop's own pixel
  // width" into "a fraction of that SAME shared world," which was then a
  // valid fraction of Milky's canvas too, since his canvas used to be that
  // same 852-wide world. Now that his canvas is an unrelated 700-wide
  // crop at a different zoom level, that shared-world assumption is gone
  // — dividing by 852 no longer means anything relative to his new frame,
  // and produced a tile width thin enough to read as a broken/dashed
  // sliver rather than a solid stream (the actual "broken" complaint).
  //
  // Fixed by matching apparent stream THICKNESS between the two clips
  // instead: measured the pee clip's own drawn stream width within its
  // CROP window (~5.5px average of a 90px-wide crop, i.e. ~6.1% of the
  // tile's own native width) and Milky's own drawn stream-tip width in
  // his new frame right at the exit point (~6px of his 700px-wide frame,
  // ~0.86%). The thickness-matched ratio (0.0086/0.0611 ≈ 0.14) is what
  // first fixed the "broken/dashed" complaint — each tile's own height is
  // locked to this same width via the source crop's aspect ratio
  // (CROP[3]/CROP[2] ≈ 4.7), so a thin tile is also a SHORT tile, which
  // is what made 0.14 tile the ~788px Milky-to-river gap into 6 separate
  // segments and read as "3 sections" (the actual segment count depends
  // on live gap/viewport, 6 in this session's own test render — either
  // way, visibly too many, same underlying cause).
  //
  // 2026-09-07, follow-up ("reduce it to 2, make each connecting line
  // bigger"): raised from the thickness-matched 0.14 to 0.4 — since a
  // tile's height is tied to its width via the fixed crop aspect ratio,
  // this one constant is simultaneously "how thick is the line" and "how
  // tall is one segment," so making segments both bigger AND fewer is a
  // single lever, not two. 0.4 landed exactly on 2 tiles for the gap
  // measured live this session (787.6px gap / a tileHeight of ~407.8px at
  // this width ≈ 1.93, ceils to 2) with real margin on both sides (stays
  // at 2 anywhere from ~0.386 to ~0.77) rather than sitting right at a
  // rounding boundary — but the gap itself is a live-measured page
  // distance, not a fixed constant, so a real device at a very different
  // viewport could still land on 1 or 3; get this confirmed live and
  // nudge if so.
  const STREAM_WIDTH_FRACTION = 0.4;
  // 2026-09-07, follow-up ("the one at the bottom isn't lining up, move it
  // slightly left") — real, measured artwork geometry, not a layout bug:
  // the stream isn't drawn straight down within CROP's own 90x423 window,
  // it drifts left as it descends (raw-pixel x-center scan at 6 rows
  // across all 7 frames: ~42px of 90 at the crop's own top edge, ~34.6px
  // at its bottom — a consistent ~7.6px/90 ≈ 8.4% leftward drift, present
  // in every frame). Every tile draws the exact same crop, so tile N+1's
  // own TOP always restarts at that same ~42px point — which needs to
  // line up with tile N's BOTTOM, already drifted to ~34.6px — without a
  // correction, each new tile jumps ~8.4% of its own width back to the
  // right of where the previous one ended. Harmless at the old, much
  // thinner tile width (a couple px, easy to miss) but this round's
  // "make each tile bigger" change scaled the same 8.4% source-space jump
  // up to a genuinely visible kink at every seam — almost certainly also
  // what read as the chain not looking like one continuous, naturally
  // "moving"/flowing stream, not just a misalignment.
  const SEAM_SHIFT_FRACTION = 0.084;

  const tiles = [];

  function ensureTiles(count) {
    while (tiles.length < count) {
      const c = document.createElement('canvas');
      c.width = CROP[2];
      c.height = CROP[3];
      c.setAttribute('aria-hidden', 'true');
      chain.appendChild(c);
      tiles.push(c);
      startBlackKeyedCanvas(peeVideo, c, CROP, PEE_KEY_BLEND);
    }
    tiles.forEach((c, i) => {
      c.style.display = i < count ? 'block' : 'none';
      // Cumulative: each tile has to correct for its own drift AND
      // reconnect to the tile above it, which was already shifted by the
      // same amount — tile 2 needs 2x the single-tile correction, tile 3
      // needs 3x, and so on down the chain.
      c.style.transform = `translateX(-${i * SEAM_SHIFT_FRACTION * 100}%)`;
    });
  }

  // "the yellow pee line isn't touching the river" — this used to assume
  // bocr-princess-river.png has a fully solid, opaque top band before its
  // own drips start, so landing on riverRect.top would already read as
  // flush, and only added a small fixed-px overlap to cover rounding
  // error. That assumption is wrong: the CSS masking .bocr-river-wrap's own
  // ::before/::after (style.css, see the comment on the mask-image there)
  // pixel-scanned the *actual* PNG and found the opposite — its drawn top
  // edge is a soft hand-inked line with real transparency, fully
  // transparent at row 0 and not fully opaque until ~9% down the image's
  // own height. riverRect.top is where that fringe STARTS, not where the
  // river reads as visually solid — so the chain was landing (plus a few
  // px) on a spot that's still see-through, leaving exactly the visible
  // gap reported. Fixed by targeting the same ~9% depth the mask already
  // treats as "fully opaque," scaled off riverRect.height so it stays
  // correct at any viewport/tile size (this whole function already
  // re-measures every frame via chainTick below, so this tracks live too).
  // RIVER_OVERLAP_PX stays on top as the original small safety margin for
  // sub-pixel/rounding slop, now against that real visible edge instead of
  // the transparent one.
  const RIVER_VISIBLE_FRACTION = 0.09;
  const RIVER_OVERLAP_PX = 8;

  function layout() {
    const spotRect = milkySpot.getBoundingClientRect();
    const milkyRect = milkyCanvas.getBoundingClientRect();
    const riverRect = riverWrap.getBoundingClientRect();

    const width = milkyRect.width * STREAM_WIDTH_FRACTION;
    const left = (milkyRect.left - spotRect.left) + milkyRect.width * EXIT_X_FRACTION - width / 2;
    const exitY = milkyRect.top + milkyRect.height * EXIT_Y_FRACTION;
    const top = exitY - spotRect.top;
    const riverVisibleTop = riverRect.top + riverRect.height * RIVER_VISIBLE_FRACTION;
    const gap = (riverVisibleTop - exitY) + RIVER_OVERLAP_PX;

    chain.style.left = left + 'px';
    chain.style.top = top + 'px';
    chain.style.width = width + 'px';

    if (gap <= 0) {
      chain.style.height = '0px';
      ensureTiles(0);
      return;
    }
    chain.style.height = gap + 'px';

    const tileHeight = width * (CROP[3] / CROP[2]);
    ensureTiles(Math.max(1, Math.ceil(gap / tileHeight)));
  }

  // 2026-09-13: "the pee line still isn't touching/reaching the river" —
  // this used to call layout() exactly once (the first time milkySpot
  // crossed the IntersectionObserver's threshold) and otherwise only ever
  // again on a window 'resize'. That one-shot measurement is only correct
  // if every ancestor above the river (the roof art, the reel, the crew
  // heading, .bocr-platforms) has already reached its FINAL rendered size
  // at that exact instant — true once everything's fully loaded, but
  // genuinely NOT guaranteed on first scroll-in: web fonts swapping in
  // (changing .bocr-crew-heading's own text metrics), a spotlight embed
  // finishing its own async load/resize, or simply the observer's 0.1
  // threshold firing while a fast scroll/scroll-snap is still mid-motion,
  // can all leave the page's real layout still settling at that moment —
  // and unlike a uniform shift from something ABOVE both Milky and the
  // river (which cancels out of `gap` for free, see the layout() comment),
  // anything that changes the SPACE BETWEEN them after that one snapshot
  // (crew-heading reflowing, an embed changing .bocr-viewport's neighbors,
  // etc.) leaves this chain sized to a stale, too-small gap permanently,
  // with no further trigger to ever recompute it — exactly a "doesn't
  // reach" symptom, and one a plain resize listener can never catch since
  // nothing about the window itself needs to resize for that to happen.
  // Fixed by not trusting a single snapshot at all: run layout() on every
  // animation frame for as long as either end of the chain (Milky's spot
  // or the river) is anywhere near the viewport, same "keep re-deriving
  // from a live measurement instead of caching one" approach this file
  // already uses for the museum walker and the candle-pinned intro text.
  // getBoundingClientRect() x3 plus a cheap DOM toggle per tile is well
  // within what those other per-frame loops already spend.
  // Each observed target's own current state, since an IntersectionObserver
  // callback only reports entries that just CHANGED, not every observed
  // target's live status — tracking just "was either target in this
  // batch intersecting" would go stale the moment one target stops
  // intersecting while the other, unreported in that same callback, is
  // still in view.
  const chainVisible = { spot: false, river: false };
  let chainRaf = null;

  function chainTick() {
    layout();
    chainRaf = (chainVisible.spot || chainVisible.river) ? requestAnimationFrame(chainTick) : null;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      chainVisible[entry.target === milkySpot ? 'spot' : 'river'] = entry.isIntersecting;
    });
    if ((chainVisible.spot || chainVisible.river) && chainRaf === null) {
      chainRaf = requestAnimationFrame(chainTick);
    }
  }, { threshold: 0, rootMargin: '200px 0px 200px 0px' });

  observer.observe(milkySpot);
  observer.observe(riverWrap);
})();

// Section 4: the candle is genuine content inside section-4 now
// (position: sticky in style.css), not a fixed overlay whose visibility
// JS switched on/off — two earlier attempts at that (an instant toggle,
// then a toggle with a CSS transition) both still read as the candle
// "appearing out of nowhere," because both were fundamentally a visible/
// invisible switch flipping at some scroll threshold, just with more or
// less smoothing on top. Sticky positioning needs none of that: the
// candle simply scrolls into view like any other element and holds near
// the bottom of the viewport once it gets there — see .candle-rig in
// style.css for the mechanics. All this block does now is *movement*:
// the candle leans toward the cursor once the cursor is actually near it
// (PROXIMITY_RADIUS) and settles back to dead center — via the same
// spring, just relaxing toward a (0, 0) target — the moment the cursor
// moves back out of range. Only runs its rAF loop while section-4 is
// actually intersecting the viewport (IntersectionObserver start/stop),
// so it isn't burning a frame callback for the entire rest of the page.
(function () {
  const section = document.getElementById('section-4');
  const rig = document.getElementById('candle-rig');
  const physics = document.getElementById('candle-physics');
  const introText = document.querySelector('.s4-intro-text');
  const siteHeader = document.getElementById('site-header');
  if (!section || !rig || !physics) return;

  // "the words move up/down into the candle and disappear on scroll" — root
  // cause was that .s4-intro-text (CSS: position:sticky; top:11vh) and
  // .candle-rig are two INDEPENDENTLY sticky elements, each un-sticking on
  // its own once its own natural in-flow position runs out of room. Their
  // formulas for "where to stick" have nothing to do with each other (one's
  // a flat vh, the other's computed in positionStickyTop() from the
  // candle's own rendered height), so the real on-screen gap between them
  // drifts as you scroll and varies by viewport size — occasionally closing
  // enough to trip the is-crowded fade further down this file (the
  // "disappears" half of the complaint). Fix: while section-4 is in view,
  // stop letting the text be independently sticky at all — pin its `top`
  // every frame to a fixed pixel distance above the candle rig's own live
  // getBoundingClientRect, using the same rAF loop already driving the
  // mouse-follow wobble below. This makes the gap a true constant instead
  // of an emergent side effect of two unrelated formulas.
  //
  // First attempt at this pinned the gap against .candle-rig's own
  // bounding box top — wrong anchor. positionFlame() (candle-ignite block,
  // further down this file) draws the lit fire canvas MUCH taller than the
  // candle itself (FIRE_WIDTH_VW=0.8, anchored on the wick so most of the
  // canvas extends upward past it) — at a 1440px-wide viewport its real
  // flame content starts roughly 170px above .candle-rig's own top edge,
  // nowhere close to the rig's own box. Pinning 40px off the rig's top
  // therefore put the text's bottom edge well BELOW the flame's real top
  // once lit — squarely inside the danger zone the is-crowded check below
  // watches for, which is exactly why it got worse (fade now triggered
  // constantly instead of only on the old drift's worst moments) instead
  // of better. Fixed by measuring the same real anchor the is-crowded
  // check already uses — candleImg plus whichever flame canvas is actually
  // showing, at its own real (non-transparent-padding) content top — and
  // pinning the text a safe distance above THAT, every frame. This also
  // means the fade check further down should now never actually trigger
  // (the enforced gap is bigger than its SAFE_GAP_PX threshold), left in
  // place as a harmless redundant safety net rather than removed.
  //
  // Second fix, same day: "before the candle lights up, keep the words at
  // the same height as after" — the fade canvases are `display:none` until
  // lit, and a display:none element's getBoundingClientRect() is always
  // all-zero, so candleTopEdge() below could only ever see the small unlit
  // candle before ignition, then suddenly saw the much-taller fire canvas
  // the instant it lit — a real jump in the text's own position, not just
  // a visibility change. Fixed by reading the fire/spark canvases'
  // intended geometry straight off the inline `style.top`/`style.height`
  // positionFlame() (candle-ignite block below) already writes on load and
  // on every resize — those are set UNCONDITIONALLY regardless of the
  // canvas's current display state, so this now sees the same "where the
  // flame WOULD be" answer whether it's actually showing yet or not,
  // giving a constant anchor across the whole unlit->lit lifecycle instead
  // of one that only exists once lit.
  const TEXT_CANDLE_GAP_PX = 110;
  const candleFlameCanvases = [
    [document.getElementById('candle-spark-canvas'), 0.17],
    [document.getElementById('candle-fire-canvas'), 0.34],
  ];

  function candleTopEdge() {
    const candleRect = candleImgEl ? candleImgEl.getBoundingClientRect() : rig.getBoundingClientRect();
    let top = candleRect.top;
    candleFlameCanvases.forEach(([canvas, contentTopFrac]) => {
      if (!canvas) return;
      const canvasTop = parseFloat(canvas.style.top);
      const canvasHeight = parseFloat(canvas.style.height);
      if (Number.isFinite(canvasTop) && Number.isFinite(canvasHeight)) {
        top = Math.min(top, candleRect.top + canvasTop + canvasHeight * contentTopFrac);
      }
    });
    return top;
  }

  // How close the cursor has to get to the candle's resting position
  // before it starts leaning toward it at all — measured from the
  // candle's own center, in px. Comfortably bigger than the candle
  // itself so the effect can be felt approaching it, not just once
  // hovering directly over it.
  const PROXIMITY_RADIUS = 260;
  // How far the candle can lean toward the cursor (px) once in range —
  // "slightly float", not track the cursor directly, so this stays small
  // relative to the viewport. FOLLOW_STRENGTH converts "cursor is this
  // far from the candle's resting spot" into a target lean before
  // clamping; SPRING/DAMPING ease the actual offset toward that target
  // each frame instead of snapping to it, which is what makes it read as
  // floating rather than tracking on a rail — and the same spring is what
  // pulls it back to center on its own once the cursor moves out of
  // PROXIMITY_RADIUS or leaves the window.
  const MAX_OFFSET_X = 22;
  const MAX_OFFSET_Y = 16;
  const FOLLOW_STRENGTH = 0.06;
  const SPRING = 0.05;
  const DAMPING = 0.86;

  // .candle-rig is the only content in section-4, so its normal (non-
  // stuck) flow position is right at the section's own top edge — meaning
  // it's the TOP of the viewport that it would scroll past first, not the
  // bottom, so it has to be `top`-sticky, not `bottom`-sticky, despite
  // wanting to visually rest low on screen (confirmed live: `bottom: 8vh`
  // alone just let it scroll away with the rest of the section instead of
  // sticking at all). To land it near the bottom anyway, `top` is set here
  // in JS to `viewport height - candle's own rendered height - 8vh`,
  // recomputed on resize/load — a pure-CSS `top: 84vh`-style guess would
  // drift off actual "8vh from the bottom" as soon as the candle's own
  // height (which scales with its clamp()'d width) changed relative to
  // viewport height.
  // Cut from 0.08 to 0.02 per "move the 3 mascots as well as the candle
  // and fire down a bit" — the crew (`.s4-crew`) is a sibling anchored to
  // this same rig via `bottom: 0`, so moving the rig down moves all four
  // (candle + Milky/Baby/Princess) together for free.
  const BOTTOM_GAP_VH = 0.02;

  function positionStickyTop() {
    const h = rig.offsetHeight;
    const top = window.innerHeight - h - window.innerHeight * BOTTOM_GAP_VH;
    rig.style.top = Math.max(0, top) + 'px';
  }

  positionStickyTop();
  window.addEventListener('resize', positionStickyTop);
  const candleImgEl = document.getElementById('candle-only');
  if (candleImgEl && !candleImgEl.complete) {
    candleImgEl.addEventListener('load', positionStickyTop, { once: true });
  }

  let targetX = 0, targetY = 0;
  let velocityX = 0, velocityY = 0, offsetX = 0, offsetY = 0;
  let rafId = null;

  function onMouseMove(e) {
    const rigRect = rig.getBoundingClientRect();
    const restX = rigRect.left + rigRect.width / 2;
    const restY = rigRect.top + rigRect.height / 2;
    const dx = e.clientX - restX;
    const dy = e.clientY - restY;
    if (Math.hypot(dx, dy) > PROXIMITY_RADIUS) {
      // Out of range: target snaps back to dead center, so the existing
      // spring relaxes the candle to its resting position — same "stops
      // moving when you move away" the spring already did for the mouse
      // leaving the window, just triggered by distance now too.
      targetX = 0;
      targetY = 0;
      return;
    }
    targetX = Math.max(-MAX_OFFSET_X, Math.min(MAX_OFFSET_X, dx * FOLLOW_STRENGTH));
    targetY = Math.max(-MAX_OFFSET_Y, Math.min(MAX_OFFSET_Y, dy * FOLLOW_STRENGTH));
  }

  function tick() {
    velocityX += (targetX - offsetX) * SPRING;
    velocityY += (targetY - offsetY) * SPRING;
    velocityX *= DAMPING;
    velocityY *= DAMPING;
    offsetX += velocityX;
    offsetY += velocityY;

    physics.style.transform = `translate(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px)`;

    if (introText) {
      const top = candleTopEdge() - TEXT_CANDLE_GAP_PX - introText.offsetHeight;
      // Floor was a bare 0 (viewport top) — fine on most windows, but on a
      // short/wide one the candle sits close enough to the top that the
      // computed top goes negative and clamps to 0, landing the text
      // directly under (and hidden behind) .site-header's own fixed bar.
      // Floor against the header's real rendered bottom edge instead, plus
      // a small breathing-gap, so the text can never sit that high no
      // matter how short the viewport gets.
      const headerBottom = siteHeader ? siteHeader.getBoundingClientRect().bottom : 0;
      const floor = headerBottom + 16;
      introText.style.top = Math.max(floor, top) + 'px';
    }

    rafId = requestAnimationFrame(tick);
  }

  // Only starts/stops the mousemove listener + rAF loop for performance
  // (no point tracking the cursor for the rest of the page's lifetime) —
  // does NOT touch opacity, display, or any class on `rig` anymore.
  // .candle-rig is position: sticky now (see style.css), so whether the
  // candle is actually visible on screen is handled entirely by ordinary
  // scroll/layout, the same way it would be for any other element in the
  // document — no JS visibility switch to accidentally make it "pop."
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        if (introText) introText.style.position = 'fixed';
        if (rafId === null) {
          window.addEventListener('mousemove', onMouseMove);
          rafId = requestAnimationFrame(tick);
        }
      } else if (rafId !== null) {
        window.removeEventListener('mousemove', onMouseMove);
        cancelAnimationFrame(rafId);
        rafId = null;
        if (introText) {
          introText.style.position = '';
          introText.style.top = '';
        }
      }
    });
  }, { threshold: 0 });

  observer.observe(section);
})();

// Section 4: "the words either go into the candle, or the candle will go
// into the words" — both .s4-intro-text and .candle-rig are independent
// position:sticky elements inside the same section, each un-sticking on its
// own once ITS OWN natural flow position runs out of room, not necessarily
// at the same scroll depth as the other. An earlier version of this guard
// only watched "is section-4's bottom edge close to the viewport bottom"
// and faded the text there — that caught the sticky-unstick overlap at the
// very END of the section but missed the exact same overlap happening on
// the way IN. A scroll-depth guess can't know that, so this measures the
// real thing instead: the live pixel gap between the text's own bottom edge
// and the topmost currently-visible pixel of the candle/flame, read fresh
// via getBoundingClientRect on every scroll tick. Whenever that gap closes
// past SAFE_GAP_PX the text fades itself out of the way — same
// .reveal-text opacity transition already in place, just retargeted — and
// fades back in the instant the gap reopens (e.g. scrolling back up), so it
// never has to guess where either sticky element currently sits.
//
// Deliberately does NOT factor in the party-favor crew (.s4-crew) even
// once revealed, despite an earlier version of this file measuring their
// canvases too. .s4-intro-text's own z-index:6 already sits above
// .candle-rig's z-index:5 (see that rule's own comment), so the text stays
// fully legible on top of the crew no matter how much their boxes overlap
// — re-including the crew here only produces a false "too close" positive
// off pure bounding-box math, and fading the text away over a problem
// z-index already solved is what caused it to disappear at all.
//
// Real root cause, found by driving an actual headless Chrome with
// puppeteer (2026-09-11 — a live repro, not guesswork): it wasn't the crew,
// it was `fireCanvas` itself. Once lit, `fireCanvas`'s rendered box was
// measured at 1152x649px at a 1440x900 viewport (it's sized off
// FIRE_WIDTH_VW in the candle-ignite block, deliberately much bigger than
// the candle) with its raw `top` landing ~70px ABOVE the text's own bottom
// edge — but per that same block's own comment, the actual drawn flame
// only fills ~28%/41% of that box's width/height, the rest is transparent
// padding in the source frame. Using the raw canvas-box top treated all
// that empty padding as "flame," creating a false overlap that isn't
// there in the actual pixels — and since both elements are sticky (fixed
// relative screen positions for most of the scroll range), once it went
// permanently "too close" it stayed that way, reading as "the words
// disappear when you light the candle." Pixel-scanned every frame of
// candle-fire.mp4/candle-spark.mp4 (852x480, same technique as
// FLAME_ANCHOR_* below) for where each one's real content actually starts:
// fire ranges 0.340-0.410 of frame height across its 8 loop frames (worst
// case/highest point kept: 0.340), spark ranges 0.173-0.515 across its 5
// frames (worst case, at full expansion: 0.173). Using those fractions
// instead of the raw box top puts the fire's real measured top at ~419px
// in that same 1440x900 case — ~150px clear of the text, no false
// crowding.
(function () {
  const introText = document.querySelector('.s4-intro-text');
  const candleImg = document.getElementById('candle-only');
  // [canvas, content-top-fraction] — see the pixel-scan note above for
  // where these fractions come from; NOT 0, because both canvases are
  // rendered much larger than their actual drawn flame, with real
  // transparent padding above it in the source frame itself.
  const flameCanvases = [
    [document.getElementById('candle-spark-canvas'), 0.17],
    [document.getElementById('candle-fire-canvas'), 0.34],
  ];
  if (!introText || !candleImg) return;

  const SAFE_GAP_PX = 24;

  let ticking = false;

  function update() {
    ticking = false;
    const introBottom = introText.getBoundingClientRect().bottom;
    let candleTop = candleImg.getBoundingClientRect().top;
    // Only the actively-displayed flame canvas matters (CSS keeps the other
    // at display:none — offsetParent is null for it, same visibility check
    // the rest of the codebase uses for display:none elements).
    flameCanvases.forEach(([canvas, contentTopFrac]) => {
      if (canvas && canvas.offsetParent !== null) {
        const rect = canvas.getBoundingClientRect();
        candleTop = Math.min(candleTop, rect.top + rect.height * contentTopFrac);
      }
    });
    const tooClose = (candleTop - introBottom) < SAFE_GAP_PX;
    introText.classList.toggle('is-crowded', tooClose);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();

// Section 4: the 3 crew party-favor clips — playback (not just its *reveal*,
// which stays gated on the candle actually being lit, handled in the
// candle-ignite block below) is deferred until section-4 is getting close to
// the viewport, same as the lazy-load observer above. This used to call
// startBlackKeyedCanvas() (which calls video.play(), forcing a download)
// unconditionally at page load, the instant the script ran — section-4 is
// the last section on the page, so every visitor downloaded 3 more video
// clips before they'd scrolled anywhere near it.
//
// Uses the same single-video startBlackKeyedCanvas pattern as every other
// clip on the page (hero Milky included) — NOT a black key, though: these
// clips draw their own ink outline in essentially the same near-(0,0,0)
// black as a dropped-alpha "background" would be, so a black key can't
// tell ink from background apart (confirmed: erased the linework itself).
// Two attempts to reconstruct real alpha via a second matte video (one
// video playing independently, then a shared JS clock forcing both
// videos' currentTime) both still let color and matte drift a frame
// apart in practice and showed up as a black shadow ghosting behind the
// character. Fixed at the SOURCE instead of chasing the sync bug further:
// each clip is composited at transcode time (ffmpeg, using the source's
// real alpha channel — the one thing that actually knows what's
// background) over a solid green backing (`s4-crew-{name}-green.mp4`),
// so there's only one plain video again, keyed against green instead of
// black. The character's own colors (white/brown fur, pink cat, primary-
// color party favors — ink included) all sit far from saturated green,
// so this separates cleanly with a lot of margin, unlike black. Widened
// past the first attempt's 40/80 to 45/120 after a visible green fringe
// on anti-aliased edges turned out to be spill (color contamination baked
// in at encode time), not an under-tuned ramp — see applyBlackKey's own
// spill-suppression comment, which does most of the actual work here.
(function () {
  const section = document.getElementById('section-4');
  const characters = [
    { video: document.getElementById('s4-crew-milky-source'), canvas: document.getElementById('s4-crew-milky-canvas') },
    { video: document.getElementById('s4-crew-baby-source'), canvas: document.getElementById('s4-crew-baby-canvas') },
    { video: document.getElementById('s4-crew-princess-source'), canvas: document.getElementById('s4-crew-princess-canvas') },
  ].filter((c) => c.video && c.canvas);
  if (!section || !characters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      characters.forEach((c) => startBlackKeyedCanvas(c.video, c.canvas, null, CREW_GREEN_BLEND, CREW_GREEN, CREW_GREEN_SIMILARITY));
    });
  }, { rootMargin: '0px 0px 600px 0px' });
  observer.observe(section);
})();

// Section 4: click the *top* of the candle (the wick end, where a real
// match would touch) to spark it — spark plays once per click
// (startBlackKeyedCanvas + the source video's own 'ended' event, same
// handoff pattern as Milky's intro->loop above). Lighting used to take 3
// sparks (a past request); per a later "make pressing it once enough",
// SPARKS_NEEDED is back down to 1 — the very first spark's 'ended' event
// now hands straight off to the looping fire, which stays lit permanently
// once it appears (an earlier version had it fade out after a timer and
// only THEN warm the room — backwards from what was wanted: the fire
// doesn't go out, and the room/crew reveal happen the moment the fire
// actually appears instead). One-shot once lit: doesn't relight or
// re-count on further clicks. SPARKS_NEEDED is kept as a named constant
// (not hardcoded to 1 throughout) in case a future request wants more
// than one click again.
(function () {
  const candleImg = document.getElementById('candle-only');
  const sparkCanvas = document.getElementById('candle-spark-canvas');
  const fireCanvas = document.getElementById('candle-fire-canvas');
  const sparkVideo = document.getElementById('candle-spark-source');
  const fireVideo = document.getElementById('candle-fire-source');
  const section = document.getElementById('section-4');
  const riverWrap = document.querySelector('.bocr-river-wrap');
  const footer = document.getElementById('site-footer');
  const clickHint = document.getElementById('candle-click-hint');
  if (!candleImg || !sparkCanvas || !fireCanvas || !sparkVideo || !fireVideo || !section) return;

  // Anchor points, both as fractions of their own element's box, for
  // lining the flame canvases up against the candle instead of their own
  // geometric center. WICK_X comes from pixel-scanning candle-only.png's
  // source crop (144/350 — see assets/web/candle-only.png's own recipe).
  //
  // WICK_Y is split in two, per "only make the fire appear [flush on the
  // candle] after it's lit, not during the spark": SPARK_WICK_Y is the
  // drawn wick string's own tip (25/1330, floating well above the candle
  // body) — the spark is a match catching *at the wick*, so it stays up
  // there. FIRE_WICK_Y is the candle's actual rim, used only once truly
  // lit, so the settled flame sits flush on the body covering the string
  // entirely rather than hovering above it with the string visible in the
  // gap (re-measured via a row-by-row opacity-coverage scan across the
  // candle's full body width, not just the thin string: coverage ramps
  // from ~10% at y~175 of 1330 up to ~100% solid by y~214-218; picked
  // y=210 as the rim). Keeping these two separate (rather than one WICK_Y
  // used for both, an earlier round's mistake) is what actually keeps the
  // spark and the lit fire visually distinct.
  const WICK_X = 144 / 350;
  const SPARK_WICK_Y = 25 / 1330;
  const FIRE_WICK_Y = 210 / 1330;
  // FLAME_ANCHOR_* comes from pixel-scanning both candle-spark.mp4 and
  // candle-fire.mp4 for where their drawn flame/glow actually sits within
  // their shared 852x480 frame (~(430, 296) for both — close enough
  // between the two, and both gifs were clearly exported from the same
  // source canvas, that one shared anchor works for both rather than
  // needing two separate ones).
  const FLAME_ANCHOR_X = 430 / 852;
  const FLAME_ANCHOR_Y = 296 / 480;
  // Flame sizing is relative to the *viewport*, not the candle's own
  // width — sized against the candle it read as barely-there. Spark is an
  // explicit 40% of screen width per request. Fire started at 0.24, then
  // 0.34 — both undersold by a non-obvious multiplier: the fire clip's
  // own drawn flame only fills ~28%/41% of its 852x480 source frame's
  // width/height (`FIRE_WIDTH_VW` scales that whole padded frame, not the
  // visible flame shape itself), so the *real* on-screen flame width is
  // roughly FIRE_WIDTH_VW*0.28, not FIRE_WIDTH_VW directly — confirmed by
  // compositing real cropped/keyed frames with sharp and measuring the
  // actual non-background pixel bbox rather than reasoning about the raw
  // vw number. Jumped to 1.4 per "make the fire WAY bigger", eased down to
  // 1.15 on desktop per "way too big on PC" (mobile's 1.4 was separately
  // confirmed fine at the time), then per a later plain "make the fire
  // smaller" (no desktop/mobile distinction called out that time) cut
  // both again — desktop 1.15->0.8, mobile 1.4->1.0 — since the candle
  // itself also got ~20% smaller in the same round, which would have made
  // the fire read as relatively even bigger than before if left alone.
  const SPARK_WIDTH_VW = 0.40;
  // 2026-09-13: desktop fire size switched from a pure viewport-WIDTH
  // fraction to a viewport-MIN (narrower of width/height) fraction — "this
  // whole part looks very different on different monitor sizes... make it
  // dynamically adjust to the screen's height AND width" (same reasoning
  // as .candle-rig's own CSS comment). A pure-width fraction means a short
  // 1920x900 window and a tall 1920x1400 one render an identically-sized
  // fire despite very different available vertical room. Rescaled by
  // 19.2/10.8=1.7778 (this file's 1920x1080 tuning reference: 1% of
  // min(1920,1080) is 10.8px, vs 1% of 1920 width being 19.2px) so the
  // already-tuned 1920x1080 look is unchanged — only OTHER aspect ratios
  // now respond correctly. Mobile's own FIRE_WIDTH_VW_MOBILE is untouched
  // and stays a plain width fraction, same as every other mobile-scoped
  // value in this project (see positionAll()'s own basis argument below).
  const FIRE_WIDTH_VW_DESKTOP = 1.4222;
  const FIRE_WIDTH_VW_MOBILE = 1.0;
  const MOBILE_BREAKPOINT = 700;
  // "Move the fire to the right a bit" (0.03), then "move the fire very
  // slightly to the left" as a follow-up — eased back down to 0.01, still
  // a touch right of dead-center on the wick but much less than before.
  // Applied only to the fire canvas's own left offset (as a fraction of
  // viewport width, so it scales the same way the flame's own size does),
  // not the spark, which stays anchored exactly on the wick.
  const FIRE_X_SHIFT_VW = 0.01;

  // Wider black-key blend than the site's default (BLACK_KEY_BLEND=40 in
  // startBlackKeyedCanvas above) — at the large sizes above, the default
  // ramp left a visible dark ring at the flame's edge (anti-aliased
  // edge pixels that blend flame-color toward black were snapping to
  // "fully opaque" while still muddy/dark — see the long comment on
  // applyBlackKey for the full explanation). This only affects the
  // candle's own canvases, not any other character on the page.
  const CANDLE_KEY_BLEND = 220;

  // basisPx is what widthFrac is a fraction OF — defaults to viewport width
  // (spark, and fire on mobile, both still plain width fractions, matching
  // every other mobile-scoped value in this project). Desktop fire passes
  // Math.min(innerWidth, innerHeight) instead — see FIRE_WIDTH_VW_DESKTOP's
  // own comment for why.
  function positionFlame(canvas, widthFrac, wickY, xShiftFrac, basisPx) {
    const w = candleImg.clientWidth;
    const h = candleImg.clientHeight;
    const flameW = (basisPx || window.innerWidth) * widthFrac;
    const flameH = flameW * (480 / 852);
    canvas.style.width = flameW + 'px';
    canvas.style.height = flameH + 'px';
    canvas.style.left = (w * WICK_X - flameW * FLAME_ANCHOR_X + window.innerWidth * (xShiftFrac || 0)) + 'px';
    canvas.style.top = (h * wickY - flameH * FLAME_ANCHOR_Y) + 'px';
  }

  function positionAll() {
    positionFlame(sparkCanvas, SPARK_WIDTH_VW, SPARK_WICK_Y);
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const fireWidthVw = isMobile ? FIRE_WIDTH_VW_MOBILE : FIRE_WIDTH_VW_DESKTOP;
    const fireBasis = isMobile ? window.innerWidth : Math.min(window.innerWidth, window.innerHeight);
    positionFlame(fireCanvas, fireWidthVw, FIRE_WICK_Y, FIRE_X_SHIFT_VW, fireBasis);
  }

  positionAll();
  window.addEventListener('resize', positionAll);
  // candle-only's own width is a clamp(), which only reacts to viewport
  // width changes, not to the candle's fade-in — but positioning before
  // the image has actually loaded/decoded would read a 0 clientWidth, so
  // also redo it once the image is definitely sized.
  if (candleImg.complete) positionAll();
  else candleImg.addEventListener('load', positionAll, { once: true });

  // How much of the candle's own rendered height, measured down from its
  // top edge, counts as "the top" for click purposes — generous enough to
  // be an easy target on a tall, thin candle without covering its whole
  // body (the wick itself sits at WICK_Y=25/1330 ≈ 2% down, right at the
  // very top of that range).
  const TOP_CLICK_FRACTION = 0.35;
  const SPARKS_NEEDED = 1;

  let state = 'unlit'; // unlit -> igniting -> lit (permanent)
  let stopSparkKey = null;
  let sparkCount = 0;

  candleImg.addEventListener('click', (e) => {
    if (state !== 'unlit') return;
    const rect = candleImg.getBoundingClientRect();
    const relY = (e.clientY - rect.top) / rect.height;
    if (relY > TOP_CLICK_FRACTION) return;

    state = 'igniting';
    if (clickHint) clickHint.classList.add('is-hidden');
    sparkCanvas.style.display = 'block';
    sparkVideo.currentTime = 0;
    stopSparkKey = startBlackKeyedCanvas(sparkVideo, sparkCanvas, null, CANDLE_KEY_BLEND);
    sparkVideo.play();
  });

  sparkVideo.addEventListener('ended', () => {
    if (state !== 'igniting') return;
    if (stopSparkKey) stopSparkKey();
    sparkCanvas.style.display = 'none';
    sparkCount += 1;

    if (sparkCount < SPARKS_NEEDED) {
      // Not lit yet — go back to accepting another click on the candle's
      // top rather than handing off to the fire. Re-shows the hint too
      // (dead code at the current SPARKS_NEEDED=1, but keeps this branch
      // correct if that ever goes back up, same as SPARKS_NEEDED's own
      // reason for still existing as a named constant).
      state = 'unlit';
      if (clickHint) clickHint.classList.remove('is-hidden');
      return;
    }

    fireCanvas.style.display = 'block';
    fireVideo.currentTime = 0;
    startBlackKeyedCanvas(fireVideo, fireCanvas, null, CANDLE_KEY_BLEND);
    fireVideo.play();
    state = 'lit';

    // The fire appearing (after the Nth spark, SPARKS_NEEDED above) is the
    // trigger — not a timer, not it going back out again.
    section.classList.add('is-warm');
    if (riverWrap) riverWrap.classList.add('is-warm');
    if (footer) footer.classList.add('is-warm');

    const crew = document.getElementById('s4-crew');
    if (crew) crew.classList.add('is-revealed');

    // The .s4-intro-text crowd check further down this file (the one that
    // toggles .is-crowded) only recomputes on 'scroll'/'resize' — it has no
    // way to know the crew's tall canvases just appeared, since revealing
    // them fires neither event. Without this nudge, the text keeps
    // whatever crowded/not-crowded state it had from BEFORE ignition until
    // the user happens to scroll again, at which point it recalculates
    // against the now-revealed (taller) crew and can snap to hidden with no
    // scrolling in between — reading as "the words disappeared when I
    // clicked the candle." Dispatching a synthetic scroll event forces that
    // check to run immediately, against the crew's now-final geometry
    // (only opacity is still transitioning, not layout, so the canvases'
    // rects are already correct at this exact instant).
    window.dispatchEvent(new Event('scroll'));

    // "when the candle lights up, the [cursor fire] effect will be gone" —
    // this fire-appearing moment is the same one-shot trigger every other
    // is-warm effect on the page hangs off of, see the s4-embers block
    // below for the element itself.
    s4EmbersLit = true;
  });
})();

// Section 4: cursor-follow fire-spark particles over the dark "empty room",
// before the candle is lit — per request ("give the mouse cursor some type
// of fire effect... but when the candle lights up, the effect will be
// gone"), replacing an earlier single-blob-with-CSS-flicker version per
// feedback that it "looked like a circle" and janky — see .s4-embers in
// style.css for why a pool of small spawned particles instead. Skipped
// entirely on touch devices (pointer: coarse/no hover) — there's no
// persistent cursor to spawn a trail from, just a finger that would
// otherwise leave particles stuck at the last tap point. Gated on
// section-4 actually intersecting, same as the candle-follow block above,
// so this isn't tracking mousemove for the entire rest of the page's
// lifetime. `s4EmbersLit` (module-scope, set true by the candle-ignite
// block above the instant the flame appears) is the one-shot permanent
// off-switch — checked here rather than a CSS class so a spawn already
// mid-flight when it flips just finishes naturally instead of vanishing.
let s4EmbersLit = false;
(function () {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const section = document.getElementById('section-4');
  const container = document.getElementById('s4-embers');
  if (!section || !container) return;

  // A small reused pool rather than creating/destroying a div per spawn —
  // cheap, and bounds how many can ever be in flight at once regardless of
  // how fast the mouse moves. Sized against SPAWN_INTERVAL_MS and each
  // particle's own max lifetime (~0.55s) below: at a spawn roughly every
  // 15ms, up to ~550/15 ≈ 37 could be genuinely in flight simultaneously
  // during continuous movement — 48 gives a little headroom before the
  // round-robin below starts cutting a still-flying particle's animation
  // short to reuse it (visually harmless either way, just a slightly
  // shorter-lived spark).
  const POOL_SIZE = 48;
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.className = 's4-ember';
    container.appendChild(el);
    pool.push(el);
  }
  let poolIndex = 0;

  // "Make it happen more often/faster": cut the spawn interval (30ms->15ms,
  // roughly twice as many sparks) and the per-particle flight duration
  // (was 0.55-1.05s, now 0.25-0.45s) so each one darts out and is gone
  // quicker instead of drifting lazily.
  const SPAWN_INTERVAL_MS = 15;
  let lastSpawn = 0;

  // Reported as "clicking the candle got very laggy" right after the first
  // version of this shipped — traced to spawnEmber's own restart trick
  // (classList.remove + `void el.offsetWidth` to force a reflow, then
  // classList.add), which forces the browser to synchronously recompute
  // layout on every single spawn. At a spawn every 15-30ms while the mouse
  // is moving (which it necessarily is, right up until the click), that's
  // dozens of forced synchronous reflows per second competing with the
  // click handler on the main thread. Element.animate() (Web Animations
  // API) replaces the whole class+reflow dance: it starts a fresh,
  // independent animation instance with no layout read/force needed at
  // all, and .cancel()-ing a still-running one before reusing its element
  // is cheap. This is the actual fix for the lag, not just the spawn-rate
  // tuning above.
  function spawnEmber(x, y) {
    const el = pool[poolIndex];
    poolIndex = (poolIndex + 1) % pool.length;

    if (el._anim) el._anim.cancel();

    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 90;
    // Biased upward (negative Y) — embers/sparks rising off a flame, not
    // drifting in every direction equally — by compressing the vertical
    // component before applying it, rather than a plain uniform circle.
    const dx = Math.cos(angle) * distance;
    const dy = -Math.abs(Math.sin(angle) * distance) - 20;
    const duration = 250 + Math.random() * 200;

    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el._anim = el.animate(
      [
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
        { opacity: 1, offset: 0.2 },
        { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.15)`, opacity: 0 },
      ],
      { duration, easing: 'cubic-bezier(0.15, 0.6, 0.35, 1)', fill: 'forwards' }
    );
  }

  function onMouseMove(e) {
    if (s4EmbersLit) return;
    const now = performance.now();
    if (now - lastSpawn < SPAWN_INTERVAL_MS) return;
    lastSpawn = now;
    // A small jitter around the exact cursor point so consecutive spawns
    // during fast movement don't all land on precisely the same pixel —
    // reads more like a scattering trail, less like beads on a wire.
    spawnEmber(e.clientX + (Math.random() - 0.5) * 8, e.clientY + (Math.random() - 0.5) * 8);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        window.addEventListener('mousemove', onMouseMove);
      } else {
        window.removeEventListener('mousemove', onMouseMove);
      }
    });
  }, { threshold: 0 });

  observer.observe(section);
})();
