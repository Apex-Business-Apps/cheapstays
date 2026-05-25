import { useEffect, useRef } from "react";

type SeoProps = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown>;
};

const SITE_URL = "https://cheapstays.me";
const DEFAULT_IMAGE = `${SITE_URL}/favicon.png`;

const upsertMeta = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
};

const upsertLink = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
};

export const Seo = ({ title, description, path = "/", image = DEFAULT_IMAGE, type = "website", jsonLd }: SeoProps) => {
  const jsonLdScriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const canonicalUrl = `${SITE_URL}${path}`;

    document.title = title;

    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });

    upsertLink('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });
  }, [description, image, path, title, type]);

  useEffect(() => {
    // Remove previous dynamic JSON-LD script injected by this component
    if (jsonLdScriptRef.current) {
      jsonLdScriptRef.current.remove();
      jsonLdScriptRef.current = null;
    }

    if (jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-component", "true");
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
      jsonLdScriptRef.current = script;
    }

    return () => {
      if (jsonLdScriptRef.current) {
        jsonLdScriptRef.current.remove();
        jsonLdScriptRef.current = null;
      }
    };
  }, [jsonLd]);

  return null;
};
