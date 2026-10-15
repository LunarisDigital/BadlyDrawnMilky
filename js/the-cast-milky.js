// The Cast — Milky. This page's clips are plain opaque <video> elements
// (full illustrated scenes, not character cutouts), so none of main.js's
// canvas-keying machinery applies here — see the-cast-milky.html's own
// comment on the origin-story panels for why main.js itself isn't loaded on
// this page at all (same reasoning as contact.html: nothing here needs it).
// This file only reuses the two small, genuinely generic patterns main.js
// already established for every other page: the scroll-reveal fade/rise
// (.reveal-text) and the explicit play()-with-retry-on-first-interaction
// fallback for autoplay <video> (the plain HTML `autoplay` attribute alone
// doesn't reliably start playback in every browser — see main.js's own
// identical comment on the header logo clip).

(function () {
  const targets = Array.from(document.querySelectorAll('.reveal-text'));
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

(function () {
  const videos = Array.from(document.querySelectorAll('video[autoplay]'));
  videos.forEach((video) => {
    const p = video.play();
    if (p && p.catch) {
      p.catch(() => {
        const retry = () => { video.play(); document.removeEventListener('pointerdown', retry); };
        document.addEventListener('pointerdown', retry, { once: true });
      });
    }
  });
})();

// Brand Spirit quote "scrawl": wraps every word of each [data-scrawl]
// element in its own .tcm-word span with a --word-i custom property, so
// style.css's transition-delay: calc(var(--word-i) * 0.08s) can stagger
// them left-to-right once the paragraph itself picks up .is-revealed (see
// the reveal-text observer above — same element, same class, one trigger).
// .tcm-quote-accent is treated as a single atomic "word" (not recursed
// into) so its nested hand-drawn SVG underline rises in as one unit with
// "3 P's" instead of the underline splitting off on its own. Runs once on
// load, well before anything scrolls into view, so there's no flash of
// the pre-wrap text.
(function () {
  const targets = Array.from(document.querySelectorAll('[data-scrawl]'));
  if (!targets.length) return;

  targets.forEach((root) => {
    let i = 0;
    (function walk(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/).filter((part) => part !== '');
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
            } else {
              const span = document.createElement('span');
              span.className = 'tcm-word';
              span.style.setProperty('--word-i', i++);
              span.textContent = part;
              frag.appendChild(span);
            }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.classList.contains('tcm-quote-accent')) {
            child.classList.add('tcm-word');
            child.style.setProperty('--word-i', i++);
          } else if (child.tagName !== 'BR') {
            walk(child);
          }
        }
      });
    })(root);
  });
})();

// Personality & Bio pinned sequence: which beat counts as "active" (and
// therefore which sticky-panel art/dot lights up) is decided by an
// IntersectionObserver per beat rather than continuous scroll-position
// math, since all that's actually needed is "which one is centered right
// now" — see the-cast-milky.html's own comment on .tcm-bio for why this
// is plain CSS sticky, not scroll-jacking. rootMargin shrinks the
// observed viewport down to a thin band around dead-center (10% tall)
// so exactly one ~72vh-tall beat is ever "intersecting" it at a time
// instead of several at once near the section's top/bottom edges.
//
// On mobile (see that same comment for the grid-overlap layout) the real
// .tcm-bio-beat text is invisible — a scroll-trigger spacer only — and
// .tcm-bio-caption-mobile is what's actually shown, centered under the
// pinned art. activate() mirrors the now-current beat's own heading/
// paragraph markup into it (copied from the DOM, not duplicated by hand
// in HTML, so there's one source of truth) rather than swapping it
// instantly, so it reads as deliberately "switching" the same way the
// art crossfades rather than jump-cutting — opacity dips to 0, the text
// swaps while invisible, then fades back in. Harmless no-op on desktop,
// where .tcm-bio-caption-mobile stays display:none.
(function () {
  const beats = Array.from(document.querySelectorAll('.tcm-bio-beat'));
  if (!beats.length) return;

  const artImgs = Array.from(document.querySelectorAll('.tcm-bio-art-img'));
  const dots = Array.from(document.querySelectorAll('.tcm-bio-dot'));
  const captionMobile = document.querySelector('.tcm-bio-caption-mobile');
  let captionTimer = null;

  function beatMarkup(beatIndex) {
    const beat = beats.find((b) => b.dataset.beat === beatIndex);
    const node = beat && beat.querySelector('h2, p');
    return node ? node.innerHTML : '';
  }

  if (captionMobile) {
    captionMobile.innerHTML = beatMarkup('0');
    captionMobile.dataset.current = captionMobile.innerHTML;
    captionMobile.classList.add('is-visible');
  }

  function activate(beatIndex) {
    artImgs.forEach((img) => img.classList.toggle('is-active', img.dataset.beat === beatIndex));
    dots.forEach((dot) => dot.classList.toggle('is-active', dot.dataset.dot === beatIndex));

    if (!captionMobile) return;
    const html = beatMarkup(beatIndex);
    if (!html || html === captionMobile.dataset.current) return;
    captionMobile.dataset.current = html;
    captionMobile.classList.remove('is-visible');
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => {
      captionMobile.innerHTML = html;
      captionMobile.classList.add('is-visible');
    }, 200);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) activate(entry.target.dataset.beat);
    });
  }, { threshold: 0, rootMargin: '-45% 0px -45% 0px' });

  beats.forEach((beat) => observer.observe(beat));
})();

// Origin Story manga panels, rebuilt 2026-10-15 (several times now) into a
// literal 3D spiral/ribbon drum, per a reference image: a ribbon coils
// around a vertical pole, each panel mounted flat on one loop of it, and
// the panel currently facing the viewer is the one you can read — exactly
// like the red boxes in that reference marking each loop's front-facing
// face. Real CSS 3D (`perspective` on .tcm-manga, `rotateY` + `translateZ`
// on each panel), not 2D translate/rotate/scale fakery — see style.css's
// own comment on .tcm-manga-stage.is-spiral .tcm-manga for the perspective
// setup.
//
// The trick making a panel read as "mounted on a rotating drum" rather
// than "a sign that stays facing you while it orbits": `rotateY(angle)
// translateZ(radius)`, in that order, rotates the panel's own local axes
// FIRST and only then pushes it outward along its (now-rotated) Z axis —
// so the panel ends up both at the right point on the circle AND facing
// the same direction that point on the circle faces (radially outward),
// same as a label glued to a spinning drum. No counter-rotation. At
// angle 0 that's a pure push toward the camera (biggest/closest/front,
// perfectly flat and readable); at 90° it's directly to the side,
// foreshortened to a sliver by its own rotation; at 180° it's pushed
// straight away from the camera, and backface-visibility:hidden (see
// style.css) makes it vanish entirely once it's facing away, like it's
// swung around to the unreadable back of the ribbon.
//
// One shared angle of rotation (`STEP_DEG * overall`) is applied to all 3
// panels at once, each offset from the others by 360/panels.length
// degrees around the drum — so turning the drum by one step always
// brings exactly the next panel's loop around to front while the current
// one swings away to the side. `overall` itself is NOT simply
// `progress * (panels.length - 1)` — see mapProgressToOverall() below for
// why and how it's remapped.
//
// PERSPECTIVE MAGNIFICATION BUG (found after "the left/right side of the
// panel and its words are cut off"): translateZ(radius) doesn't just
// move a panel toward the camera, it also visually MAGNIFIES it — under
// a `perspective` projection, pushing something closer makes it render
// bigger, exactly like a real camera dolly-zoom. At radius 512px against
// perspective 1700px that's a ~43% size increase even at a panel's own
// perfectly-flat resting angle — ballooning its ~980px natural content
// width out to ~1400px, blowing straight through .tcm-manga's 1024px
// clip on both sides, confirmed by comparing getBoundingClientRect()
// with and without the transform applied. Fixing it by shrinking the
// radius would have gutted the swing distance the spiral depends on to
// read as a rotation at all — instead COMPENSATE (below) is a flat
// `scale()` baked into every panel's transform, sized so it exactly
// cancels that magnification at each panel's OWN resting angle (where
// translateZ's forward push, and therefore the zoom, is at its biggest),
// with a bit of extra safety margin on top. Scale composes correctly
// with everything else here because it's the innermost/rightmost
// function in the transform list — it shrinks the panel's own local
// geometry before translateZ/rotateY/translateY ever act on it, so it
// changes the panel's rendered SIZE without touching its position in
// the drum.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const stage = document.querySelector('.tcm-manga-stage');
  const manga = document.querySelector('.tcm-manga');
  const panels = Array.from(document.querySelectorAll('.tcm-panel'));
  if (!stage || !manga || !panels.length) return;

  stage.classList.add('is-spiral');
  stage.style.setProperty('--tcm-panel-count', String(panels.length));

  const STEP_DEG = 360 / panels.length; // angular spacing between loops around the drum
  const RADIUS_FRACTION = 0.5;          // how far a panel sits from the central pole, as a fraction of the pinned box's own width
  const MIN_RADIUS_PX = 260;            // floor on that radius, so narrow mobile widths still swing panels far enough apart to read clearly
  const PERSPECTIVE_PX = 1700;          // must match .tcm-manga-stage.is-spiral .tcm-manga's own `perspective` in style.css
  const SIZE_SAFETY = 0.94;             // shrinks panels a bit further than the exact magnification-cancelling amount, for margin against clipping
  const REST_DROP_PX = 36;              // each panel's own RESTING pose sits this much lower than the one before it (small — stays within the pinned box even for the last panel)
  const ARC_PX = 190;                   // peak extra vertical travel mid-swing, on top of REST_DROP_PX — this is what actually reads as "spiral", not just a flat disc rotating
  const FADE_START_DEG = 66;            // a panel starts dimming this many degrees off dead-center...
  const FADE_END_DEG = 90;              // ...fully gone (edge-on) by here, just before backface-culling would hard-cut it

  // How much of each panel-to-panel transition is a dead/"locked" zone
  // right after leaving a panel (DWELL, a fraction of that transition's
  // own scroll distance) before the drum starts actually turning toward
  // the next one, and the ease curve used for the turning portion once
  // it does. Replaces an earlier version that snapped the scroll position
  // itself back to the nearest panel on a timer once scrolling stopped —
  // the user didn't want an animation stealing control of the scrollbar;
  // this gets the same "locks onto a panel, decelerates into it" feel
  // entirely by reshaping how much rotation a given amount of scroll
  // produces, using nothing but native scroll (see mapProgressToOverall).
  const DWELL_FRACTION = 0.22;
  function easeTurn(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Turns the stage's raw linear scroll progress (0..1) into `overall`
  // (0..panels.length-1, same meaning as before: the panel at this exact
  // value is dead-center). Linear progress is sliced into
  // (panels.length - 1) equal segments, one per panel-to-panel
  // transition; within segment i, the first DWELL_FRACTION of that
  // segment's own scroll distance holds `overall` flat at i (a visitor
  // who stops scrolling there is still looking at panel i, perfectly
  // flat — this is the "locked, needs a few more scrolls" zone), and the
  // rest eases from i to i+1 via easeTurn, which starts and ends at zero
  // velocity — "slows down and stops when you get to a panel" without
  // needing to touch the actual scroll position at all.
  function mapProgressToOverall(progress) {
    const segments = panels.length - 1;
    const linear = progress * segments;
    const segIndex = Math.min(segments - 1, Math.floor(linear));
    const s = linear - segIndex;
    const turn = s < DWELL_FRACTION ? 0 : easeTurn((s - DWELL_FRACTION) / (1 - DWELL_FRACTION));
    return segIndex + turn;
  }

  let ticking = false;

  function update() {
    ticking = false;
    const rect = stage.getBoundingClientRect();
    const totalScroll = stage.offsetHeight - window.innerHeight;
    const progress = totalScroll > 0
      ? Math.max(0, Math.min(1, -rect.top / totalScroll))
      : 0;
    const overall = mapProgressToOverall(progress);
    // Radius is the panel box's own width (the pinned/clipped .tcm-manga,
    // max-width 64rem), not .tcm-manga-stage's — the stage spans the
    // whole section's content width with no max-width, so using its rect
    // blew the radius out to ~1.8x too big and swung panels clean off
    // the clipped box at anything past a shallow angle. Floored at
    // MIN_RADIUS_PX so narrow mobile widths (where .tcm-manga itself is
    // barely wider than a phone screen) still swing panels far enough
    // apart to read as a rotation instead of a near-flat shuffle.
    const radius = Math.max(manga.getBoundingClientRect().width * RADIUS_FRACTION, MIN_RADIUS_PX);
    // See this block's own top comment on the perspective magnification
    // bug — this is the exact factor that cancels translateZ(radius)'s
    // own size boost at a panel's resting angle, times SIZE_SAFETY for
    // margin.
    const compensate = SIZE_SAFETY * (PERSPECTIVE_PX - radius) / PERSPECTIVE_PX;

    panels.forEach((panel, i) => {
      const angle = STEP_DEG * (overall - i);
      const angleRad = angle * Math.PI / 180;
      const absAngle = Math.abs(angle);
      const depth = Math.cos(angleRad); // 1 = facing the camera dead-on, 0 = edge-on, -1 = facing away
      // sin(angle) is exactly 0 at this panel's own resting pose (angle
      // 0) and peaks mid-swing (~angle ±90, which is also right where
      // FADE_START/END are) — so the dramatic part of the arc plays out
      // while the panel is still visible, and resting there never fights
      // this term.
      const y = i * REST_DROP_PX + ARC_PX * Math.sin(angleRad);
      const fade = absAngle <= FADE_START_DEG
        ? 1
        : Math.max(0, 1 - (absAngle - FADE_START_DEG) / (FADE_END_DEG - FADE_START_DEG));

      panel.style.transform =
        `translateY(${y.toFixed(1)}px) rotateY(${angle.toFixed(2)}deg) translateZ(${radius.toFixed(1)}px) scale(${compensate.toFixed(4)})`;
      panel.style.opacity = fade.toFixed(3);
      panel.style.zIndex = String(Math.round((depth + 1) * 500));
      panel.style.pointerEvents = depth > 0.5 ? 'auto' : 'none';
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  // Only listens while the stage is actually on screen — same
  // performance reasoning as every other scroll-driven block on this
  // page (no point recalculating this for the rest of the page's
  // lifetime).
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        window.addEventListener('scroll', onScroll, { passive: true });
        update();
      } else {
        window.removeEventListener('scroll', onScroll);
      }
    });
  }, { threshold: 0 });

  observer.observe(stage);
  update();
  window.addEventListener('resize', onScroll, { passive: true });
})();

// Known For flip cards: click/tap toggles .is-flipped (and keeps
// aria-pressed in sync for screen readers) so touch devices — which have
// no :hover — can still flip a card; style.css's own (hover: hover)
// guard handles real mouse hover separately and independently of this.
(function () {
  const bits = Array.from(document.querySelectorAll('.tcm-bit'));
  bits.forEach((bit) => {
    bit.addEventListener('click', () => {
      const flipped = bit.classList.toggle('is-flipped');
      bit.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    });
  });
})();

// Quote doodle (milky-wag-tail.mp4): paused at rest on its own first
// frame, only plays while actually hovered. Click/tap toggles it too
// (same hover-AND-tap-both pattern as the flip cards above, since touch
// has no hover to trigger playback from at all) — doesn't just mirror
// mouseenter/mouseleave, which some touch browsers fire as a synthetic
// pair right around a tap anyway.
(function () {
  const doodle = document.querySelector('.tcm-quote-doodle');
  if (!doodle) return;

  function play() {
    doodle.currentTime = 0;
    doodle.play();
  }

  function stop() {
    doodle.pause();
    doodle.currentTime = 0;
  }

  doodle.addEventListener('mouseenter', play);
  doodle.addEventListener('mouseleave', stop);
  doodle.addEventListener('click', () => {
    if (doodle.paused) play(); else stop();
  });
})();

// .tcm-pet-cursor: the real cursor is swapped for this floating
// milky-pet-palm.png while a fine-pointer mouse is anywhere over
// .tcm-quote — see style.css's own comment on .tcm-pet-cursor/
// .has-pet-cursor for the positioning/animation mechanics (left/top set
// here per frame, kept separate from the CSS `rotate` property so the
// idle-wobble/petting keyframes never fight this over `transform`).
// Skipped entirely on coarse/no-hover pointers, same reasoning as the
// section-4 embers block in main.js — there's no cursor to replace on
// touch.
(function () {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const section = document.querySelector('.tcm-quote');
  const cursor = document.querySelector('.tcm-pet-cursor');
  if (!section || !cursor) return;

  // The source art (milky-pet-palm.png) is a diagonal paw reaching from
  // a wrist/cuff at its bottom-left up to the actual paw pad near its
  // top-right — HOTSPOT_X/Y is that pad's position as a fraction of the
  // image's own rendered box, so left/top below can be offset to land
  // THAT point on the real pointer instead of the image's top-left
  // corner (the original bug: nothing accounted for the art's own
  // padding/shape, so the whole image sat down-and-right of the actual
  // cursor with a visible gap between them).
  const HOTSPOT_X = 0.71;
  const HOTSPOT_Y = 0.26;

  let rafId = null;
  let pendingX = 0;
  let pendingY = 0;

  function position() {
    rafId = null;
    cursor.style.left = `${pendingX - cursor.offsetWidth * HOTSPOT_X}px`;
    cursor.style.top = `${pendingY - cursor.offsetHeight * HOTSPOT_Y}px`;
  }

  section.addEventListener('pointerenter', (e) => {
    pendingX = e.clientX;
    pendingY = e.clientY;
    position();
    section.classList.add('has-pet-cursor');
    cursor.classList.add('is-active');
  });

  section.addEventListener('pointerleave', () => {
    section.classList.remove('has-pet-cursor');
    cursor.classList.remove('is-active');
  });

  section.addEventListener('pointermove', (e) => {
    pendingX = e.clientX;
    pendingY = e.clientY;
    if (rafId === null) rafId = requestAnimationFrame(position);
  });

  // .is-petting is removed on its own animationend (not a timeout) so it
  // can never get stuck re-added mid-flight; the void-offsetWidth forces
  // a reflow between remove/add so clicking again mid-petting restarts
  // the dip from the top instead of the second click doing nothing
  // because the class never actually left.
  section.addEventListener('click', () => {
    cursor.classList.remove('is-petting');
    void cursor.offsetWidth;
    cursor.classList.add('is-petting');
  });

  cursor.addEventListener('animationend', (e) => {
    if (e.animationName === 'tcm-pet-down') cursor.classList.remove('is-petting');
  });
})();
