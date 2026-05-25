/**
 * Canonical language maps for the Pip agent.
 *
 * LANG_BCP47          — maps app language codes to BCP-47 tags for SpeechRecognition.
 * LANG_TTS_PREFIXES   — maps app codes to voice.lang prefix arrays for SpeechSynthesis.
 *                       Filipino needs two prefixes: browsers disagree on "fil" vs "tl".
 * LANG_NAMES          — display names used in system-prompt language instructions.
 */

export const LANG_BCP47: Record<string, string> = {
  en:  "en-US",
  fil: "fil-PH",
  zh:  "zh-CN",
  ms:  "ms-MY",
  id:  "id-ID",
  ko:  "ko-KR",
  vi:  "vi-VN",
  ja:  "ja-JP",
  th:  "th-TH",
};

export const LANG_TTS_PREFIXES: Record<string, string[]> = {
  en:  ["en"],
  fil: ["fil", "tl"],  // Chrome on Android: "fil-PH"; some desktop builds: "tl-PH"
  zh:  ["zh"],
  ms:  ["ms"],
  id:  ["id"],
  ko:  ["ko"],
  vi:  ["vi"],
  ja:  ["ja"],
  th:  ["th"],
};

export const LANG_NAMES: Record<string, string> = {
  en:  "English",
  fil: "Filipino (Tagalog)",
  zh:  "Chinese (Simplified)",
  ms:  "Malay",
  id:  "Indonesian",
  ko:  "Korean",
  vi:  "Vietnamese",
  ja:  "Japanese",
  th:  "Thai",
};
