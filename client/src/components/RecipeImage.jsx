import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";

const PHOTOS = Object.fromEntries(
  Object.entries(
    import.meta.glob("../assets/recipes/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}", {
      eager: true,
      query: "?url",
      import: "default",
    })
  ).map(([path, url]) => [stem(path), url])
);

function stem(path) {
  return path.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase();
}

function resolve(src) {
  if (!src) return "";
  if (/^https?:\/\//.test(src)) return src;
  return PHOTOS[stem(src)] ?? `${import.meta.env.BASE_URL}${src.replace(/^\//, "")}`;
}

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
