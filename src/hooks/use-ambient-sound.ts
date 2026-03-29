"use client";
import { useState, useRef, useCallback, useEffect } from "react";

export type AmbientSound = "silence" | "rain" | "coffee" | "ocean" | "lofi" | "whitenoise";

const SOUND_URLS: Record<AmbientSound, string | null> = {
  silence: null,
  // Using free ambient sound URLs (royalty-free)
  rain: "https://cdn.pixabay.com/audio/2022/05/13/audio_257112f5ad.mp3",
  coffee: "https://cdn.pixabay.com/audio/2024/11/13/audio_38c36e4a55.mp3",
  ocean: "https://cdn.pixabay.com/audio/2022/03/10/audio_c1e1a4f5f8.mp3",
  lofi: "https://cdn.pixabay.com/audio/2024/02/14/audio_c0e2b32e14.mp3",
  whitenoise: "https://cdn.pixabay.com/audio/2022/03/15/audio_942e4c7f4f.mp3",
};

export const SOUND_OPTIONS: { value: AmbientSound; label: string; emoji: string }[] = [
  { value: "silence", label: "Silence", emoji: "🔇" },
  { value: "rain", label: "Rain", emoji: "🌧️" },
  { value: "coffee", label: "Coffee shop", emoji: "☕" },
  { value: "ocean", label: "Ocean waves", emoji: "🌊" },
  { value: "lofi", label: "Lo-fi beats", emoji: "🎵" },
  { value: "whitenoise", label: "White noise", emoji: "⬜" },
];

const STORAGE_KEY = "flowfocus_ambient_sound";

export function useAmbientSound() {
  const [sound, setSound] = useState<AmbientSound>(() => {
    if (typeof window === "undefined") return "silence";
    return (localStorage.getItem(STORAGE_KEY) as AmbientSound) || "silence";
  });
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((s?: AmbientSound) => {
    const chosen = s ?? sound;
    if (chosen === "silence" || !SOUND_URLS[chosen]) {
      stop();
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(SOUND_URLS[chosen]!);
    audio.loop = true;
    audio.volume = 0.3;
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPlaying(true);
  }, [sound]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      // Fade out
      const audio = audioRef.current;
      const fade = setInterval(() => {
        if (audio.volume > 0.05) {
          audio.volume = Math.max(0, audio.volume - 0.05);
        } else {
          clearInterval(fade);
          audio.pause();
          audio.currentTime = 0;
        }
      }, 50);
      audioRef.current = null;
    }
    setPlaying(false);
  }, []);

  const setAndSave = useCallback((s: AmbientSound) => {
    setSound(s);
    localStorage.setItem(STORAGE_KEY, s);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { sound, setSound: setAndSave, playing, play, stop };
}