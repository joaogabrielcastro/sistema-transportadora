import { useEffect } from "react";
import PropTypes from "prop-types";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../brand.js";

const DEFAULT_DESCRIPTION = `${PRODUCT_NAME} — ${PRODUCT_TAGLINE} para transportadoras. Frota, gastos, manutenção, documentos e indicadores em um só lugar.`;

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
}

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
}) {
  useEffect(() => {
    const fullTitle = title.includes(PRODUCT_NAME)
      ? title
      : `${title} · ${PRODUCT_NAME}`;
    document.title = fullTitle;

    upsertMeta('meta[name="description"]', {
      name: "description",
      content: description,
    });
    upsertMeta('meta[property="og:title"]', {
      property: "og:title",
      content: fullTitle,
    });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: description,
    });
    upsertMeta('meta[property="og:type"]', {
      property: "og:type",
      content: "website",
    });
    upsertMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image",
    });

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    if (origin) {
      upsertMeta('meta[property="og:url"]', {
        property: "og:url",
        content: `${origin}${path}`,
      });
      upsertMeta('meta[property="og:image"]', {
        property: "og:image",
        content: `${origin}/atrack-512x512.png`,
      });
    }
  }, [title, description, path]);

  return null;
}

Seo.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  path: PropTypes.string,
};
