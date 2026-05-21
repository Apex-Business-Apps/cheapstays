import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLang } from "@/i18n";

const LANGUAGES = [
  { code: "en",  label: "English" },
  { code: "fil", label: "Filipino" },
  { code: "zh",  label: "中文" },
  { code: "ms",  label: "Melayu" },
  { code: "id",  label: "Indonesia" },
  { code: "ko",  label: "한국어" },
  { code: "vi",  label: "Tiếng Việt" },
  { code: "ja",  label: "日本語" },
  { code: "th",  label: "ภาษาไทย" },
];

const LABEL: Record<string, string> = {
  en: "EN", fil: "FIL", zh: "ZH", ms: "MS",
  id: "ID", ko: "KO", vi: "VI", ja: "JA", th: "TH",
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2 h-8 text-muted-foreground hover:text-foreground"
          aria-label="Select language"
        >
          <Globe className="h-4 w-4 shrink-0" />
          <span className="text-[11px] font-semibold tracking-wide hidden sm:inline">
            {LABEL[current] ?? "EN"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={setLang}
        >
          {LANGUAGES.map((l) => (
            <DropdownMenuRadioItem
              key={l.code}
              value={l.code}
              className="cursor-pointer text-sm"
            >
              {l.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
