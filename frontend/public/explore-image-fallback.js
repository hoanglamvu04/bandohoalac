(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function replaceWithHolaGuide(image) {
    if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-explore-fallback')) {
      return;
    }

    const fallback = document.createElement('div');
    fallback.className = image.classList.contains('large')
      ? 'explore-card-fallback large'
      : 'explore-card-fallback';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', 'HOLA GUIDE');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', image.classList.contains('large') ? '42' : '30');
    svg.setAttribute('height', image.classList.contains('large') ? '42' : '30');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'm16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z');

    const label = document.createElement('span');
    label.textContent = 'HOLA GUIDE';

    svg.append(circle, path);
    fallback.append(svg, label);
    image.replaceWith(fallback);
  }

  // Capture image errors because the native error event does not bubble.
  document.addEventListener('error', (event) => {
    replaceWithHolaGuide(event.target);
  }, true);

  // Also catch images that failed before this deferred script was executed.
  document.querySelectorAll('img[data-explore-fallback]').forEach((image) => {
    if (image.complete && image.naturalWidth === 0) {
      replaceWithHolaGuide(image);
    }
  });
})();
