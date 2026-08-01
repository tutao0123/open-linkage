import { Geist, Geist_Mono } from "next/font/google";

export const homeSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--home-font-sans",
});

export const homeMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--home-font-mono",
});
