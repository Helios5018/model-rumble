#!/usr/bin/env python3
"""Model Rumble 素材管线：
1. 调 gpt-image-2 生成洋红底 raw sheet
2. 调 agent-sprite-forge 后处理（抠图/切帧/对齐）
3. 组装成 Phaser 水平 strip + 更新 manifest.json

用法：
  python3 pipeline.py gen-char claude idle        # 生成单个角色动作
  python3 pipeline.py gen-fx slash_fx             # 生成特效
  python3 pipeline.py gen-portrait claude         # 生成头像
  python3 pipeline.py gen-stage                   # 生成场景背景
  python3 pipeline.py process-char claude idle    # 只跑后处理+组装（raw 已存在）
  python3 pipeline.py manifest                    # 重新生成 manifest.json
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # model-rumble/
RAW_DIR = ROOT / "assets-work" / "raw"
PROC_DIR = ROOT / "assets-work" / "processed"
GAME_ASSETS = ROOT / "game" / "public" / "assets"
GEN_SCRIPT = Path("/Users/link/.claude/skills/media-generation/providers/image/gpt-image-2/scripts/generate.py")
FORGE = ROOT / "tools" / "agent-sprite-forge" / "skills" / "generate2dsprite" / "scripts" / "generate2dsprite.py"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from assets_spec import ACTIONS, CHARACTERS, FX, character_sheet_prompt, fx_sheet_prompt, portrait_prompt, STAGE_DESC

FRAME_SIZE = 128  # 游戏内帧尺寸


def run(cmd: list[str]) -> None:
    print("+", " ".join(str(c) for c in cmd)[:200])
    subprocess.run([str(c) for c in cmd], check=True)


def generate_raw(prompt: str, out_path: Path, size: str, quality: str = "medium") -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    run([
        "python3", GEN_SCRIPT,
        "--prompt", prompt,
        "--quality", quality,
        "--size", size,
        "--out", out_path,
        "-y",
    ])


def process_sheet(raw: Path, out_dir: Path, rows: int, cols: int, align: str = "feet") -> list[Path]:
    """跑 agent-sprite-forge 后处理，返回切好的帧列表"""
    out_dir.mkdir(parents=True, exist_ok=True)
    run([
        "python3", FORGE, "process",
        "--input", raw,
        "--target", "asset",
        "--mode", "attack",  # mode 只影响默认网格，rows/cols 显式给出
        "--rows", str(rows),
        "--cols", str(cols),
        "--output-dir", out_dir,
        "--align", align,
        "--shared-scale",
        "--component-mode", "largest" if align == "feet" else "all",
        "--fit-scale", "0.88",
        "--threshold", "110",
        "--edge-threshold", "160",
        "--single-size", str(FRAME_SIZE * 2),
        "--label-prefix", "frame",
    ])
    frames = sorted(out_dir.glob("frame-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
    if not frames:
        raise SystemExit(f"未找到帧输出: {out_dir}")
    return frames


def assemble_strip(frames: list[Path], out_png: Path, frame_size: int = FRAME_SIZE) -> int:
    """把帧组装成水平 strip（每帧 frame_size x frame_size）"""
    from PIL import Image

    out_png.parent.mkdir(parents=True, exist_ok=True)
    n = len(frames)
    strip = Image.new("RGBA", (frame_size * n, frame_size), (0, 0, 0, 0))
    for i, fp in enumerate(frames):
        img = Image.open(fp).convert("RGBA")
        img = img.resize((frame_size, frame_size), Image.LANCZOS)
        strip.paste(img, (i * frame_size, 0), img)
    strip.save(out_png)
    print(f"strip -> {out_png} ({n} frames)")
    return n


def char_anim_out(char_id: str, action: str) -> Path:
    return GAME_ASSETS / "characters" / char_id / f"{action}.png"


def gen_char(char_id: str, action: str, quality: str = "medium") -> None:
    a = ACTIONS[action]
    raw = RAW_DIR / "characters" / char_id / f"{action}.png"
    generate_raw(character_sheet_prompt(char_id, action), raw, a["size"], quality)
    process_char(char_id, action)


def process_char(char_id: str, action: str) -> None:
    a = ACTIONS[action]
    raw = RAW_DIR / "characters" / char_id / f"{action}.png"
    proc = PROC_DIR / "characters" / char_id / action
    frames = process_sheet(raw, proc, a["rows"], a["cols"], align="feet")
    assemble_strip(frames, char_anim_out(char_id, action))
    write_manifest()


def gen_fx(fx_key: str, quality: str = "medium") -> None:
    f = FX[fx_key]
    raw = RAW_DIR / "fx" / f"{fx_key}.png"
    generate_raw(fx_sheet_prompt(fx_key), raw, f["size"], quality)
    process_fx(fx_key)


def process_fx(fx_key: str) -> None:
    f = FX[fx_key]
    raw = RAW_DIR / "fx" / f"{fx_key}.png"
    proc = PROC_DIR / "fx" / fx_key
    frames = process_sheet(raw, proc, f["rows"], f["cols"], align="center")
    assemble_strip(frames, GAME_ASSETS / "fx" / f"{fx_key}.png")
    write_manifest()


def gen_portrait(char_id: str, quality: str = "medium") -> None:
    out = GAME_ASSETS / "ui" / f"portrait_{char_id}.png"
    generate_raw(portrait_prompt(char_id), out, "1024x1024", quality)
    write_manifest()


PLATFORM_PROMPTS = {
    "main": (
        "A single wide floating platform for a 2D platform fighter game, side view: a sleek dark-slate tech slab "
        "with glowing cyan circuit edge lines and small holographic vents on the underside, flat walkable top surface, "
        "strong horizontal proportions (very wide, thin), centered. "
        "Solid flat pure magenta background #FF00FF, no text, no watermark, clean anime game art style."
    ),
    "float": (
        "A single small floating hover-platform for a 2D platform fighter game, side view: a compact dark-slate tech slab "
        "with glowing cyan edge light and tiny anti-gravity emitters underneath, flat walkable top, wide and thin, centered. "
        "Solid flat pure magenta background #FF00FF, no text, no watermark, clean anime game art style."
    ),
}


def gen_platform(which: str, quality: str = "medium") -> None:
    raw = RAW_DIR / "stages" / f"platform_{which}.png"
    generate_raw(PLATFORM_PROMPTS[which], raw, "1536x1024", quality)
    process_platform(which)


def process_platform(which: str) -> None:
    """直接从 raw 原图抠洋红，保留原始分辨率"""
    import numpy as np
    from PIL import Image

    raw = RAW_DIR / "stages" / f"platform_{which}.png"
    img = Image.open(raw).convert("RGBA")
    arr = np.array(img).astype(int)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    # 洋红判定：红蓝高、绿低
    magenta = (r > 150) & (b > 150) & (g < 110) & (abs(r - b) < 90)
    arr[..., 3] = np.where(magenta, 0, arr[..., 3])
    out_img = Image.fromarray(arr.astype("uint8"), "RGBA")
    bbox = out_img.getbbox()
    if bbox:
        out_img = out_img.crop(bbox)
    out = GAME_ASSETS / "stages" / f"platform_{which}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    out_img.save(out)
    print(f"platform -> {out} ({out_img.width}x{out_img.height})")
    write_manifest()


def gen_stage(quality: str = "high") -> None:
    out = GAME_ASSETS / "stages" / "benchmark_arena.png"
    generate_raw(STAGE_DESC, out, "1536x1024", quality)
    write_manifest()


MENU_BG_PROMPT = (
    "Epic key-art background for a futuristic AI fighting game menu screen: the interior of a vast high-tech arena "
    "colosseum at night, holographic data displays and neon light beams around the edges, dramatic purple-blue-teal "
    "lighting with warm orange accents, volumetric god rays from above, a clean dark open area across the center and "
    "bottom two-thirds for UI elements, cinematic wide composition, clean anime game art style. "
    "No characters, no text, no watermark, no logo."
)

LOGO_PROMPT = (
    "Bold metallic video-game logo with the exact text \"MODEL RUMBLE\" in two stacked lines or one line, "
    "energetic fighting-game typography, chrome with electric blue and burning orange gradient, subtle lightning "
    "cracks and glow, slight italic forward lean, highly readable. "
    "Solid flat pure magenta background #FF00FF everywhere behind the logo. No watermark, no extra text."
)


def gen_ui(which: str, quality: str = "high") -> None:
    if which == "menu_bg":
        out = GAME_ASSETS / "ui" / "menu_bg.png"
        generate_raw(MENU_BG_PROMPT, out, "1536x1024", quality)
    elif which == "logo":
        import numpy as np
        from PIL import Image

        raw = RAW_DIR / "ui" / "logo.png"
        generate_raw(LOGO_PROMPT, raw, "1536x1024", quality)
        img = Image.open(raw).convert("RGBA")
        arr = np.array(img).astype(int)
        r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
        magenta = (r > 150) & (b > 150) & (g < 110) & (abs(r - b) < 90)
        arr[..., 3] = np.where(magenta, 0, arr[..., 3])
        out_img = Image.fromarray(arr.astype("uint8"), "RGBA")
        bbox = out_img.getbbox()
        if bbox:
            out_img = out_img.crop(bbox)
        out = GAME_ASSETS / "ui" / "logo.png"
        out_img.save(out)
        print(f"logo -> {out} ({out_img.width}x{out_img.height})")
    else:
        raise SystemExit(f"未知 UI 素材: {which}")


def flip_strip(png_path: Path, frame_size: int = FRAME_SIZE) -> None:
    """把 strip 中每一帧水平翻转（修正朝向错误的生成结果）"""
    from PIL import Image

    strip = Image.open(png_path).convert("RGBA")
    n = strip.width // frame_size
    out = Image.new("RGBA", strip.size, (0, 0, 0, 0))
    for i in range(n):
        frame = strip.crop((i * frame_size, 0, (i + 1) * frame_size, frame_size))
        out.paste(frame.transpose(Image.FLIP_LEFT_RIGHT), (i * frame_size, 0))
    out.save(png_path)
    print(f"flipped -> {png_path}")


def write_manifest() -> None:
    """扫描 game/public/assets 生成 manifest.json（只登记已存在的素材）"""
    manifest: dict = {"characters": {}, "fx": {}, "stage": {}}
    for char_id in CHARACTERS:
        anims = {}
        for action, a in ACTIONS.items():
            p = char_anim_out(char_id, action)
            if p.exists():
                from PIL import Image

                w = Image.open(p).width
                anims[action] = {
                    "file": f"assets/characters/{char_id}/{action}.png",
                    "frames": w // FRAME_SIZE,
                    "frameWidth": FRAME_SIZE,
                    "frameHeight": FRAME_SIZE,
                    "frameRate": a["frameRate"],
                    "repeat": a["repeat"],
                }
        entry: dict = {"anims": anims}
        portrait = GAME_ASSETS / "ui" / f"portrait_{char_id}.png"
        if portrait.exists():
            entry["portrait"] = f"assets/ui/portrait_{char_id}.png"
        if anims or "portrait" in entry:
            manifest["characters"][char_id] = entry
    for fx_key, f in FX.items():
        p = GAME_ASSETS / "fx" / f"{fx_key}.png"
        if p.exists():
            from PIL import Image

            w = Image.open(p).width
            manifest["fx"][fx_key] = {
                "file": f"assets/fx/{fx_key}.png",
                "frames": w // FRAME_SIZE,
                "frameWidth": FRAME_SIZE,
                "frameHeight": FRAME_SIZE,
                "frameRate": f["frameRate"],
            }
    stage = GAME_ASSETS / "stages" / "benchmark_arena.png"
    if stage.exists():
        manifest["stage"]["background"] = "assets/stages/benchmark_arena.png"
    if (GAME_ASSETS / "stages" / "platform_main.png").exists():
        manifest["stage"]["platformMain"] = "assets/stages/platform_main.png"
    if (GAME_ASSETS / "stages" / "platform_float.png").exists():
        manifest["stage"]["platformFloat"] = "assets/stages/platform_float.png"
    out = GAME_ASSETS / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"manifest -> {out}")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    args = sys.argv[2:]
    if cmd == "gen-char":
        gen_char(*args)
    elif cmd == "process-char":
        process_char(*args)
    elif cmd == "gen-fx":
        gen_fx(*args)
    elif cmd == "process-fx":
        process_fx(*args)
    elif cmd == "gen-portrait":
        gen_portrait(*args)
    elif cmd == "gen-stage":
        gen_stage(*args)
    elif cmd == "gen-ui":
        gen_ui(*args)
    elif cmd == "gen-platform":
        gen_platform(*args)
    elif cmd == "process-platform":
        process_platform(*args)
    elif cmd == "flip":
        flip_strip(Path(args[0]))
    elif cmd == "manifest":
        write_manifest()
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
