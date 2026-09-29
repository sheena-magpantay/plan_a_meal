import { useEffect, useState } from "react";

export default function LoadingLabel({ messages, interval = 1400 }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    const id = setInterval(
      () => setIndex((current) => Math.min(current + 1, messages.length - 1)),
      interval
    );
    return () => clearInterval(id);
  }, [messages, interval]);

  return (
    <span className="loadingLabel" role="status" aria-live="polite">
      {messages[index]}
      <span className="loadingDots" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </span>
  );
}

export const AI_RECIPE_STEPS = [
  "Getting ready",
  "Asking the AI",
  "Writing your recipe",
  "Picking ingredients",
  "Checking prices",
  "Almost there",
];

export const PRICING_STEPS = ["Getting ready", "Checking store prices", "Calculating", "Almost there"];
