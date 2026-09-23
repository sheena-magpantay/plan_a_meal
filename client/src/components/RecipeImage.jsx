import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";

// A recipe's image is a path inside client/public/ (e.g. "recipes/chicken-adobo.jpg")
// or a full URL. BASE_URL is "/" locally and "/<repo>/" on GitHub Pages, so
// public files resolve in both places.
function resolve(src) {
  if (!src) return "";
  if (/^https?:\/\//.test(src)) return src;
  return `${import.meta.env.BASE_URL}${src.replace(/^\//, "")}`;
}

// Shows a placeholder when there is no image, or the file is missing.
export default function RecipeImage({ src, className = "" }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const url = resolve(src);

  if (!url || failedUrl === url) {
    return (
      <div className={`recipeImage recipeImagePlaceholder ${className}`} aria-hidden="true">
        <UtensilsCrossed strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      className={`recipeImage ${className}`}
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailedUrl(url)}
    />
  );
}
