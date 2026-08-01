"use client";

import { useEffect } from "react";

const ROOT_SELECTOR = "[data-home-root]";
const HERO_SELECTOR = "[data-cinematic-hero]";
const REVEAL_SELECTOR = "[data-home-reveal]";

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function HomeMotionController() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
    const hero = document.querySelector<HTMLElement>(HERO_SELECTOR);
    if (!root || !hero) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;

    const updateProgress = () => {
      animationFrame = 0;

      const viewportHeight = window.innerHeight;
      const heroRect = hero.getBoundingClientRect();
      const scrollableDistance = Math.max(1, heroRect.height - viewportHeight);
      const progress = clamp(-heroRect.top / scrollableDistance);
      const stepOne = 1 - clamp(progress / 0.26);
      const stepTwo = 1 - clamp(Math.abs(progress - 0.5) / 0.24);
      const stepThree = clamp((progress - 0.68) / 0.2);

      root.style.setProperty("--home-scroll-progress", progress.toFixed(4));
      root.style.setProperty("--home-step-one", stepOne.toFixed(4));
      root.style.setProperty("--home-step-two", stepTwo.toFixed(4));
      root.style.setProperty("--home-step-three", stepThree.toFixed(4));
    };

    const scheduleProgressUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateProgress);
    };

    const updateMotionPreference = () => {
      root.toggleAttribute("data-reduced-motion", reducedMotion.matches);
      scheduleProgressUpdate();
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
    updateProgress();
    window.addEventListener("scroll", scheduleProgressUpdate, { passive: true });
    window.addEventListener("resize", scheduleProgressUpdate, { passive: true });
    reducedMotion.addEventListener("change", updateMotionPreference);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      revealObserver.disconnect();
      window.removeEventListener("scroll", scheduleProgressUpdate);
      window.removeEventListener("resize", scheduleProgressUpdate);
      reducedMotion.removeEventListener("change", updateMotionPreference);
      delete root.dataset.motionReady;
      delete root.dataset.reducedMotion;
      root.style.removeProperty("--home-scroll-progress");
      root.style.removeProperty("--home-step-one");
      root.style.removeProperty("--home-step-two");
      root.style.removeProperty("--home-step-three");
    };
  }, []);

  return null;
}
