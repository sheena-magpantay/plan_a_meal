import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";

// Recipe photos live in client/src/assets/recipes/. Vite renames bundled files
// (chicken-adobo.jpg becomes chicken-adobo-3f9a2c.jpg), so this collects every
// photo in that folder and looks them up by file name without the extension:
// "recipes/chicken-adobo.jpg" in server/db/recipes.js finds chicken-adobo.jpg,
// .png or .webp. New photos are picked up on the next page load; nothing else
// needs changing.
const PHOTOS = Object.fromEntries(
  Object.entries(
    import.meta.glob("../assets/recipes/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}", {
      eager: true,
      query: "?url",
      import: "default",
    })
  ).map(([path, url]) => [stem(path), url])
);

// "../assets/recipes/Chicken-Adobo.JPG" -> "chicken-adobo"
function stem(path) {
  return path.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase();
}

// A recipe's image is a file name as above, or a full URL (recipes users add
// can link to any picture). Anything not found in the assets folder is tried
// in client/public/ instead, so photos placed there still work. BASE_URL is
// "/" locally and "/<repo>/" on GitHub Pages.
function resolve(src) {
  if (!src) return "";
  if (/^https?:\/\//.test(src)) return src;
  return PHOTOS[stem(src)] ?? `${import.meta.env.BASE_URL}${src.replace(/^\//, "")}`;
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
