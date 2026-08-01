"use client";

import { useEffect } from "react";

const ROOT_SELECTOR = "[data-home-root]";
const REVEAL_SELECTOR = "[data-home-reveal]";

export function HomeMotionController() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
    if (!root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateMotionPreference = () => {
      root.toggleAttribute("data-reduced-motion", reducedMotion.matches);
    };

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.visible = "true";
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12%", threshold: 0.08 },
    );

    for (const element of root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)) {
      revealObserver.observe(element);
    }

    root.dataset.motionReady = "true";
    updateMotionPreference();
    reducedMotion.addEventListener("change", updateMotionPreference);

    return () => {
      revealObserver.disconnect();
      reducedMotion.removeEventListener("change", updateMotionPreference);
      delete root.dataset.motionReady;
      delete root.dataset.reducedMotion;
    };
  }, []);

  return null;
}
