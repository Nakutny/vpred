import { useEffect } from 'react';

const SITE_NAME = 'vpred.org';
const SITE_URL = 'https://vpred.org';
const DEFAULT_DESCRIPTION = 'Open Research Collective – investigative citizen journalism on companies, products and people.';

function setMeta(name, content) {
  if (!content) return;
  // Try og: and twitter: property first, then name
  let el = document.querySelector(`meta[property="${name}"]`) ||
           document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    if (name.startsWith('og:') || name.startsWith('article:')) el.setAttribute('property', name);
    else el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

export default function SEO({ title, description, image, url, type = 'website', author, publishedAt }) {
  useEffect(() => {
    const fullTitle = title ? `${title} – ${SITE_NAME}` : SITE_NAME;
    const desc = description || DEFAULT_DESCRIPTION;
    const pageUrl = url ? `${SITE_URL}${url}` : SITE_URL;
    const img = image || `${SITE_URL}/og-default.png`;

    document.title = fullTitle;

    // Standard meta
    setMeta('description', desc);

    // Open Graph
    setMeta('og:title', fullTitle);
    setMeta('og:description', desc);
    setMeta('og:url', pageUrl);
    setMeta('og:image', img);
    setMeta('og:type', type);
    setMeta('og:site_name', SITE_NAME);

    // Twitter Cards
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', desc);
    setMeta('twitter:image', img);

    // Article-specific
    if (type === 'article') {
      if (author) setMeta('article:author', author);
      if (publishedAt) setMeta('article:published_time', publishedAt);
    }

    setCanonical(pageUrl);

    return () => {
      // Reset on unmount
      document.title = SITE_NAME;
    };
  }, [title, description, image, url, type, author, publishedAt]);

  return null;
}
