"""Rebuild the full arcade sound palette; cached raw takes make runs resumable.
Run from project root: python3 tools/asset-pipeline/gen_audio_v3.py [--process-only]
"""
from pathlib import Path
import gen_combat_audio as pipeline

pipeline.RAW = pipeline.ROOT / 'assets-work/audio-v3/raw'
pipeline.OUT = pipeline.ROOT / 'game/public/assets/audio/arcade-v3'
pipeline.STYLE = (
    'Premium playful 3D arena fighter sound design, one isolated game sound. '
    'Immediate transient, warm rounded body, detailed tactile texture, short clean tail. '
    'No voice, no speech, no music bed, no ambience, no harsh piercing treble, no long reverb. '
)

NEW = {
    'swing': (.5, .24, 'A quick bare-fist swing missing the opponent, close cloth flick and airy whip, no impact.'),
    'swing_heavy': (.6, .36, 'A heavy sweeping punch winding through air, weighty cloth swoosh and low air pressure, no hit.'),
    'jump': (.5, .3, 'A small springy character launching off a soft platform, tactile foot push with a warm rubbery upward pop.'),
    'respawn': (1.2, .9, 'A friendly sci-fi avatar materializing, soft reverse shimmer opening into a clear round bell, hopeful.'),
    'ultimate': (1.6, 1.35, 'A powerful ultimate ability activating, instant bass pulse with a rising energy flare and bright resolving shimmer.'),
    'victory': (2.5, 2.2, 'A compact triumphant arcade victory logo, three warm marimba and brass-like synth notes rising to a satisfying major chord.'),
    'menu_move': (.5, .12, 'A premium interface selection click, warm wooden tick with a very soft glass sparkle, understated.'),
    'menu_confirm': (.6, .4, 'A premium game menu confirmation, two rounded ascending mallet notes with a tactile button click.'),
    'deepseek': (.8, .55, 'A magical whale water bolt, tight watery plop and fluid rushing splash, with a rounded resonant bubble.'),
    'claude': (.8, .6, 'A magical bureaucratic shield spell, a firm wooden approval stamp landing with a short warm crystalline ring.'),
    'gpt': (.8, .55, 'A friendly robot launching a tool, three tiny mechanical relay clicks resolving into a clean rounded digital zap.'),
    'gemini': (.8, .55, 'A playful twin-star cat magic dash, two quick bell-like plinks over a smooth whisking air flourish.'),
    'qwen': (.8, .6, 'A soft bear clone summoned by magic, two plush low thumps with a warm woody marimba sparkle.'),
    'grok': (.9, .65, 'A miniature cartoon starship igniting, tight rocket exhaust sputter followed by a compact powerful whoosh.'),
    'doubao': (.8, .55, 'A friendly magical speech bubble launched, round liquid bubble pop and cheerful short glass droplet flourish.'),
    'glm': (.8, .6, 'A small stone wall built instantly, chunky ceramic and stone blocks locking into place with a satisfying low clunk.'),
    'kimi': (.9, .65, 'A moon cat teleporting in starlight, delicate reversed crystal chime with a smooth airy lunar shimmer.'),
}
for name, (duration, maximum, prompt) in NEW.items():
    pipeline.SPECS[name] = (duration, maximum, [prompt + ' Take one, compact and soft.', prompt + ' Take two, slightly deeper and fuller.'])

if __name__ == '__main__':
    pipeline.main()
