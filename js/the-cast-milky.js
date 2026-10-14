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
(function () {
  const beats = Array.from(document.querySelectorAll('.tcm-bio-beat'));
  if (!beats.length) return;

  const artImgs = Array.from(document.querySelectorAll('.tcm-bio-art-img'));
  const dots = Array.from(document.querySelectorAll('.tcm-bio-dot'));

  function activate(beatIndex) {
    artImgs.forEach((img) => img.classList.toggle('is-active', img.dataset.beat === beatIndex));
    dots.forEach((dot) => dot.classList.toggle('is-active', dot.dataset.dot === beatIndex));
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) activate(entry.target.dataset.beat);
    });
  }, { threshold: 0, rootMargin: '-45% 0px -45% 0px' });

  beats.forEach((beat) => observer.observe(beat));
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
