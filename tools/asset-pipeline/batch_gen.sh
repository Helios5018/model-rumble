#!/bin/bash
# 批量生成全部素材，最多 3 个并发
cd "$(dirname "$0")/../.."
PIPE=tools/asset-pipeline/pipeline.py
LOG_DIR=assets-work/logs
mkdir -p "$LOG_DIR"

jobs_list=()
for char in claude gemini deepseek gpt qwen glm; do
  for action in idle run jump light heavy hurt; do
    # 已有产物跳过
    if [ -f "game/public/assets/characters/$char/$action.png" ]; then continue; fi
    jobs_list+=("gen-char $char $action")
  done
  if [ ! -f "game/public/assets/ui/portrait_$char.png" ]; then
    jobs_list+=("gen-portrait $char")
  fi
done
for fx in slash_fx impact_fx shield_fx beam_fx wave_fx spark_fx ultimate_flash_fx; do
  if [ ! -f "game/public/assets/fx/$fx.png" ]; then
    jobs_list+=("gen-fx $fx")
  fi
done
if [ ! -f "game/public/assets/stages/benchmark_arena.png" ]; then
  jobs_list+=("gen-stage")
fi

echo "共 ${#jobs_list[@]} 个生成任务"
i=0
for job in "${jobs_list[@]}"; do
  while [ "$(jobs -rp | wc -l)" -ge 3 ]; do sleep 2; done
  i=$((i+1))
  logfile="$LOG_DIR/$(echo "$job" | tr ' ' '_').log"
  echo "[$i/${#jobs_list[@]}] $job"
  python3 "$PIPE" $job > "$logfile" 2>&1 &
done
wait
python3 "$PIPE" manifest
echo "ALL DONE"
# 失败汇总
grep -l "Error\|error\|Traceback\|SystemExit\|未找到" "$LOG_DIR"/*.log 2>/dev/null && echo "以上日志有异常" || echo "无失败日志"
