#!/bin/bash
# 生成全部音效（ElevenLabs）+ BGM（MiniMax），落到 game/public/assets/audio/
set -u
cd "$(dirname "$0")/../.."
OUT=game/public/assets/audio
mkdir -p "$OUT"
SFX=/Users/link/.claude/skills/media-generation/providers/audio/elevenlabs/scripts/sound_effects.py
MUSIC=/Users/link/.claude/skills/media-generation/providers/audio/minimax/scripts/music.py

gen_sfx() { # name prompt duration
  if [ -f "$OUT/$1.mp3" ]; then echo "skip $1"; return; fi
  python3 "$SFX" --prompt "$2" --duration "$3" --prompt-influence 0.5 --out "$OUT/$1.mp3" && echo "OK sfx $1" || echo "FAIL sfx $1"
}

gen_sfx hit_light "quick sharp arcade fighting game punch impact, snappy, clean" 0.6 &
gen_sfx hit_heavy "powerful heavy fighting game impact with deep bass punch and crunch" 0.9 &
gen_sfx swing "fast whoosh of an energy blade swing, short, sci-fi" 0.5 &
wait
gen_sfx jump "quick soft whoosh of a game character jumping, subtle" 0.4 &
gen_sfx shield "sci-fi energy shield activation shimmer, crystalline, short" 0.8 &
gen_sfx dodge "fast dash whoosh with a light digital swish, short" 0.5 &
wait
gen_sfx ko "big explosive burst with digital glitch shatter, dramatic game knockout" 1.6 &
gen_sfx ultimate "epic sci-fi charging energy release blast, dramatic, powerful" 2.2 &
gen_sfx respawn "sparkling digital respawn chime, ascending, positive, short" 1.0 &
wait
gen_sfx menu_move "subtle digital UI menu cursor tick, very short, clean" 0.3 &
gen_sfx menu_confirm "bright digital UI confirm chime, satisfying, short" 0.5 &
gen_sfx counter "sharp metallic parry clang with an energy ring, short" 0.7 &
wait
gen_sfx victory "short triumphant electronic victory fanfare sting, celebratory" 3.0

if [ ! -f "$OUT/bgm_battle.mp3" ]; then
  python3 "$MUSIC" --prompt "High-energy electronic synthwave battle theme for a fighting game, driving beat, intense arpeggios, heroic, loopable instrumental" --out "$OUT/bgm_battle.mp3" && echo "OK bgm_battle" || echo "FAIL bgm_battle"
fi
if [ ! -f "$OUT/bgm_menu.mp3" ]; then
  python3 "$MUSIC" --prompt "Atmospheric futuristic menu music, chill synth pads, subtle digital textures, anticipation, loopable instrumental" --out "$OUT/bgm_menu.mp3" && echo "OK bgm_menu" || echo "FAIL bgm_menu"
fi
echo "AUDIO ALL DONE"
ls -la "$OUT"
