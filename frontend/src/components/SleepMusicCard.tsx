import { memo } from "react";
import { Moon } from "lucide-react";

export const SleepMusicCard = memo(function SleepMusicCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="sleep-entry-card" onClick={onOpen} aria-label="打开哄睡音乐">
      <span className="sleep-entry-orb" aria-hidden="true"><Moon size={20} /></span>
      <span className="sleep-entry-body">
        <span className="sleep-entry-title">哄睡音乐</span>
        <span className="sleep-entry-sub">白噪音 · 摇篮曲 · 睡眠定时</span>
      </span>
    </button>
  );
});
