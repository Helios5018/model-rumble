"""Generate/resume 18 combat SFX candidates, then master compact game WAVs.

python3 tools/asset-pipeline/gen_combat_audio.py
Requires ffmpeg and the configured media-generation skill. Existing raw takes are
reused (no additional API cost); --process-only never calls the provider.
"""
from __future__ import annotations

import argparse
from array import array
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import wave

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "assets-work/audio-v2/raw"
OUT = ROOT / "game/public/assets/audio/combat-v2"
RATE = 44100
MODEL = "eleven_text_to_sound_v2"
STYLE = (
    "One isolated one-shot for a playful premium arcade fighting game. "
    "Immediate attack, dry close sound, clean short decay, silence afterwards. "
    "No voice, no music, no ambience, no repeated hits, no long reverb. "
)
# name: generation duration, maximum mastered duration, three directed takes
SPECS = {
    "hit_light": (0.5, 0.24, [
        "A tight punch connecting: crisp leather smack over a compact woody knock.",
        "A fast palm strike impact: sharp dry pop with a small solid body thud.",
        "A snappy cartoon boxing impact: crisp slap and firm midrange knock, not squeaky.",
    ]),
    "hit_heavy": (0.7, 0.46, [
        "A powerful heavy punch connecting: hard crack and deep compact body thump.",
        "A heavyweight arcade slam: crunchy impact with a tight bass punch, no rumble bed.",
        "A devastating hammer fist hit: solid low thud with a brief sharp cracking edge.",
    ]),
    "shield": (0.5, 0.32, [
        "A fist hits an energy shield: rounded hard clack and a tiny glassy resonance.",
        "One blocked attack: damped metallic tok with a short warm energy ripple.",
        "A defensive shield absorbs a blow: firm hollow knock and short crystal tick.",
    ]),
    "counter": (0.7, 0.5, [
        "A perfectly timed parry: crisp metal clash with a short bright rising energy ping.",
        "One successful counterattack cue: sharp blade catch and a clean victorious ching.",
        "A perfect arcade deflection: emphatic crystalline clang with a tiny upward shimmer.",
    ]),
    "dodge": (0.5, 0.26, [
        "A very fast evasive sidestep: soft compact air swish, no impact, no metallic ring.",
        "A quick character dash: tight low airy whoosh passing instantly, light and smooth.",
        "An agile dodge: short cloth and air whip, smooth soft ending, no sharp whistle.",
    ]),
    "ko": (1.5, 1.15, [
        "One arena knockout: huge punchy impact followed by a brief descending digital shatter.",
        "One spectacular ring-out: powerful bass slam and a short playful electronic collapse.",
        "One decisive fighting game knockout: crunchy explosive hit with falling pixel debris.",
    ]),
}


def pcm(path: Path, filters: str | None = None) -> array:
    command = ["ffmpeg", "-v", "error", "-i", str(path)]
    if filters:
        command += ["-af", filters]
    data = subprocess.check_output(command + ["-ar", str(RATE), "-ac", "1", "-f", "f32le", "-"])
    samples = array("f")
    samples.frombytes(data)
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def master(source: Path, destination: Path, name: str, max_duration: float) -> dict:
    samples = pcm(source, "highpass=f=45,lowpass=f=12000")
    peak = max(map(abs, samples), default=0)
    if peak < 0.005:
        raise ValueError(f"Silent/invalid take: {source.name}")
    # Find a sustained onset; retain 2 ms pre-roll to preserve the transient.
    threshold = max(0.002, peak * 0.035)
    onset = next(i for i in range(0, len(samples), 88)
                 if max(map(abs, samples[i:i + 88]), default=0) >= threshold)
    start = max(0, onset - 88)
    samples = samples[start:start + round(max_duration * RATE)]
    active_end = max(i for i, value in enumerate(samples) if abs(value) >= threshold)
    samples = samples[:min(len(samples), max(round(0.08 * RATE), active_end + round(0.025 * RATE)))]
    # A controlled low-frequency layer adds weight without relying on sub-bass alone.
    if name in ("hit_heavy", "ko"):
        for i in range(min(len(samples), round(0.18 * RATE))):
            t = i / RATE
            envelope = min(1, t / 0.003) * math.exp(-t * 28)
            samples[i] += 0.12 * math.sin(2 * math.pi * (105 * t - 110 * t * t)) * envelope
    rms = math.sqrt(sum(x * x for x in samples) / len(samples))
    peak = max(map(abs, samples))
    # Match the body of short sounds, with peak headroom and a bounded boost.
    gain = min(10 ** (-4 / 20) / peak, 0.16 / max(rms, 0.001), 4)
    fade_in, fade_out = 35, round(0.025 * RATE)
    mastered = array("h", (
        round(max(-1, min(1, x * gain * min(1, i / fade_in) * min(1, (len(samples) - 1 - i) / fade_out))) * 32767)
        for i, x in enumerate(samples)
    ))
    if sys.byteorder != "little":
        mastered.byteswap()
    with wave.open(str(destination), "wb") as stream:
        stream.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        stream.writeframes(mastered.tobytes())
    final = pcm(destination)
    return {
        "duration": round(len(final) / RATE, 4),
        "trimmed_lead_seconds": round(start / RATE, 4),
        "peak_dbfs": round(20 * math.log10(max(map(abs, final))), 2),
        "rms_dbfs": round(20 * math.log10(math.sqrt(sum(x*x for x in final) / len(final))), 2),
        "bytes": destination.stat().st_size,
        "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--process-only", action="store_true")
    args = parser.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    os.chdir(ROOT)
    if not args.process_only:
        skill = Path(os.environ.get("MEDIA_GENERATION_SKILL", Path.home() / ".agents/skills/media-generation"))
        sys.path.insert(0, str(skill / "providers/audio/elevenlabs/scripts"))
        from sound_effects import generate, load_config

    def take(task: tuple) -> dict:
        name, variant, duration, max_duration, description = task
        stem = f"{name}_{variant}"
        source, destination = RAW / f"{stem}.mp3", OUT / f"{stem}.wav"
        prompt = STYLE + description
        if not source.exists():
            if args.process_only:
                raise FileNotFoundError(source)
            data = generate(prompt, load_config(), duration=duration,
                            prompt_influence=0.65, model=MODEL, output_format="mp3_44100_128")
            # Validate the response before treating it as a resumable candidate.
            partial = source.with_suffix(".partial.mp3")
            partial.write_bytes(data)
            pcm(partial)
            partial.replace(source)
        metrics = master(source, destination, name, max_duration)
        entry = {"name": name, "variant": variant, "file": destination.name,
                 "raw": str(source.relative_to(ROOT)), "model": MODEL,
                 "prompt": prompt, "generation_seconds": duration,
                 "prompt_influence": 0.65, **metrics}
        (RAW / f"{stem}.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2) + "\n")
        print(f"DONE {stem}: {metrics}", flush=True)
        return entry

    tasks = [(name, i + 1, duration, maximum, description)
             for name, (duration, maximum, descriptions) in SPECS.items()
             for i, description in enumerate(descriptions)]
    with ThreadPoolExecutor(max_workers=2) as executor:
        entries = list(executor.map(take, tasks))
    (OUT / "manifest.json").write_text(json.dumps({
        "model": MODEL, "sample_rate": RATE, "format": "mono PCM16 WAV",
        "processing": "45 Hz high-pass / 12 kHz low-pass, onset trim, bounded RMS/peak gain, micro fades; heavy/KO bass layer",
        "takes": entries,
    }, ensure_ascii=False, indent=2) + "\n")
    print(f"COMPLETE: {len(entries)} mastered candidates", flush=True)


if __name__ == "__main__":
    main()
