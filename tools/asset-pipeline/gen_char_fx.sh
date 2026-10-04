#!/bin/bash
# 批量生成角色专属特效（跳过已存在的成品），3 并发
set -u
ROOT="/Users/link/Code/personal/model-rumble"
PIPE="$ROOT/tools/asset-pipeline/pipeline.py"
LOG_DIR="$ROOT/assets-work/logs"
mkdir -p "$LOG_DIR"

FX_KEYS=(
  claude_slash_fx claude_impact_fx claude_shield_fx claude_ultimate_fx
  gemini_spark_fx gemini_dash_fx gemini_wave_fx gemini_ultimate_fx
  deepseek_slash_fx deepseek_buff_fx deepseek_ultimate_fx
  gpt_slash_fx gpt_code_fx gpt_dash_fx gpt_shield_fx gpt_ultimate_fx
  qwen_dart_fx qwen_impact_fx qwen_buff_fx qwen_wave_fx qwen_ultimate_fx
  glm_slash_fx glm_seal_fx glm_shield_fx glm_ultimate_fx
)

run_one() {
  local key="$1"
  local out="$ROOT/game/public/assets/fx/${key}.png"
  if [[ -f "$out" ]]; then
    echo "SKIP $key (exists)"
    return 0
  fi
  echo "GEN  $key ..."
  if python3 "$PIPE" gen-fx "$key" > "$LOG_DIR/fx_${key}.log" 2>&1; then
    echo "OK   $key"
  else
    echo "FAIL $key (see $LOG_DIR/fx_${key}.log)"
  fi
}

pids=()
for key in "${FX_KEYS[@]}"; do
  run_one "$key" &
  pids+=($!)
  while (( $(jobs -rp | wc -l) >= 3 )); do sleep 2; done
done
wait
echo "=== all done ==="
