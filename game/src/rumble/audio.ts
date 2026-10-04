import type { GameEvent } from "./simulation.ts";

const variants = (name: string, count = 2) =>
  Array.from({ length: count }, (_, i) => `/assets/audio/arcade-v3/${name}_${i + 1}.wav`);
const signature = (name: string) => ({ files: variants(name), volume: 0.34, priority: 2, gap: 0.14 });
export const CUES = {
  hit_light: { files: variants("hit_light", 3), volume: 0.52, priority: 3, gap: 0.065 },
  hit_heavy: { files: variants("hit_heavy", 3), volume: 0.68, priority: 4, gap: 0.09 },
  shield: { files: variants("shield", 3), volume: 0.4, priority: 3, gap: 0.09 },
  counter: { files: variants("counter", 3), volume: 0.62, priority: 5, gap: 0.12 },
  dodge: { files: variants("dodge", 3), volume: 0.3, priority: 1, gap: 0.09 },
  ko: { files: variants("ko", 3), volume: 0.7, priority: 7, gap: 0.2 },
  swing: { files: variants("swing"), volume: 0.2, priority: 1, gap: 0.12 },
  swing_heavy: { files: variants("swing_heavy"), volume: 0.3, priority: 2, gap: 0.18 },
  jump: { files: variants("jump"), volume: 0.2, priority: 1, gap: 0.1 },
  ultimate: { files: variants("ultimate"), volume: 0.52, priority: 6, gap: 0.3 },
  respawn: { files: variants("respawn"), volume: 0.3, priority: 2, gap: 0.2 },
  victory: { files: variants("victory"), volume: 0.48, priority: 8, gap: 0.5 },
  menu_move: { files: variants("menu_move"), volume: 0.25, priority: 0, gap: 0.06 },
  menu_confirm: { files: variants("menu_confirm"), volume: 0.36, priority: 2, gap: 0.1 },
  deepseek: signature("deepseek"), claude: signature("claude"), gpt: signature("gpt"),
  gemini: signature("gemini"), qwen: signature("qwen"), grok: signature("grok"),
  doubao: signature("doubao"), glm: signature("glm"), kimi: signature("kimi"),
} as const;
export type SoundName = keyof typeof CUES;

export function cueForEvent(event: GameEvent): SoundName | null {
  switch (event.type) {
    case "hit": return (event.power ?? 1) > 1 ? "hit_heavy" : "hit_light";
    case "block": return event.cue === "counter" ? "counter" : "shield";
    case "ko": return "ko";
    case "jump": return "jump";
    case "respawn": return "respawn";
    case "win": return null; // The result screen owns the single victory cue.
    case "cast":
      if (event.cue === "dodge") return "dodge";
      if (event.skill === "ultimate")
        return (event.power ?? 1) >= 3 ? "ultimate" : null;
      if (event.skill === "heavy") return "swing_heavy";
      if (event.skill === "light") return "swing";
      return event.skill ? event.fighter ?? "swing" : null;
  }
}

type Voice = {
  name: SoundName;
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
  priority: number;
  started: number;
};

export class AudioBus {
  muted = false;
  unlocked = false;
  current = "";
  music: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private lastVariant = new Map<SoundName, number>();
  private lastPlayed = new Map<string, number>();
  private voices: Voice[] = [];
  private paused = false;
  private epoch = 0;
  private duckUntil = 0;
  private failures = new Set<string>();
  private history: { name: SoundName; file: string; at: number }[] = [];

  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 10;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;
      this.master.connect(compressor).connect(this.context.destination);
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.13;
      this.musicGain.connect(this.master);
      void this.preload();
    }
    this.unlocked = true;
    void this.context.resume().catch(() => {});
    this.bgm(this.current || "menu");
  }

  async preload() {
    if (!this.context) return;
    await Promise.all(Object.values(CUES).flatMap((cue) => cue.files.map((url) => this.load(url))));
  }

  private load(url: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(url)) return Promise.resolve(this.buffers.get(url)!);
    const pending = this.loading.get(url);
    if (pending) return pending;
    const request = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => this.context!.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(url, buffer);
        this.failures.delete(url);
        return buffer;
      })
      .catch((error: unknown) => {
        if (!this.failures.has(url)) console.warn(`Audio unavailable: ${url}`, error);
        this.failures.add(url);
        return null;
      })
      .finally(() => this.loading.delete(url));
    this.loading.set(url, request);
    return request;
  }

  bgm(scene: string) {
    this.current = scene;
    if (!this.unlocked || !this.context) return;
    const url = `/assets/audio/bgm_${scene === "menu" ? "menu" : "battle"}.mp3`;
    if (!this.music?.src.endsWith(url)) {
      this.music?.pause();
      this.musicSource?.disconnect();
      this.music = new Audio(url);
      this.music.loop = true;
      this.musicSource = this.context.createMediaElementSource(this.music);
      this.musicSource.connect(this.musicGain!);
    }
    if (!this.paused && !this.muted && this.music.paused)
      void this.music.play().catch(() => {});
  }

  event(event: GameEvent) {
    const name = cueForEvent(event);
    const pan = Math.max(-0.65, Math.min(0.65, event.x / 12));
    if (name) this.play(name, undefined, pan, event.player);
    // A quiet character layer makes ordinary attacks identifiable too.
    if (event.type === "cast" && event.fighter &&
        (event.skill === "heavy" || event.skill === "ultimate"))
      this.play(event.fighter, event.skill === "heavy" ? 0.16 : 0.3, pan, event.player);
  }

  play(name: SoundName, volume: number = CUES[name].volume, pan = 0, player?: number) {
    const ctx = this.context;
    if (this.muted || !this.unlocked || this.paused || !ctx || ctx.state !== "running") return;
    const cue = CUES[name], now = ctx.currentTime;
    const key = `${name}:${player ?? "global"}`;
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < cue.gap) return;
    const choices = cue.files.map((file, index) => ({ file, index }))
      .filter(({ index }) => cue.files.length === 1 || index !== this.lastVariant.get(name));
    const choice = choices[Math.floor(Math.random() * choices.length)];
    const buffer = this.buffers.get(choice.file);
    if (!buffer) {
      // Never replay a stale attack after a slow download or a scene transition.
      const epoch = this.epoch;
      void this.load(choice.file).then((loaded) => {
        if (loaded && epoch === this.epoch && ctx.currentTime - now < 0.12)
          this.play(name, volume, pan, player);
      });
      return;
    }
    // Impacts take focus immediately, so swing/summon layers cannot mask contact.
    if (name === "hit_heavy" || name === "counter" || name === "ko") {
      for (const voice of [...this.voices])
        if (voice.priority < 3 && now - voice.started < 0.22) this.stopVoice(voice);
    }
    const same = this.voices.filter((voice) => voice.name === name);
    const limit = same.length >= 4 ? same : this.voices.length >= 12 ? this.voices : [];
    if (limit.length) {
      const victim = [...limit].sort((a, b) => a.priority - b.priority || a.started - b.started)[0];
      if (victim.priority > cue.priority) return;
      this.stopVoice(victim);
    }
    const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = ctx.createStereoPanner();
    source.buffer = buffer;
    source.playbackRate.value = cue.files.length > 1 && name !== "ko" ? 0.98 + Math.random() * 0.04 : 1;
    gain.gain.value = Math.max(0, Math.min(1, volume));
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(gain).connect(panner).connect(this.master!);
    const voice = { name, source, gain, pan: panner, priority: cue.priority, started: now };
    source.onended = () => {
      this.voices = this.voices.filter((v) => v !== voice);
      source.disconnect(); gain.disconnect(); panner.disconnect();
    };
    this.voices.push(voice);
    this.lastVariant.set(name, choice.index);
    this.lastPlayed.set(key, now);
    this.history.push({ name, file: choice.file, at: now });
    if (this.history.length > 40) this.history.shift();
    source.start();
    if (name === "ko" || name === "ultimate" || name === "victory" || name === "hit_heavy" || name === "counter")
      this.duckMusic(name === "victory" ? 2.4 : name === "ultimate" ? 1.5 : name === "ko" ? 0.85 : 0.22);
  }

  private stopVoice(voice: Voice) {
    const now = this.context!.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.008);
    voice.source.stop(now + 0.009);
    this.voices = this.voices.filter((v) => v !== voice);
  }

  private duckMusic(duration: number) {
    const now = this.context!.currentTime, gain = this.musicGain!.gain;
    this.duckUntil = Math.max(this.duckUntil, now + duration);
    gain.cancelAndHoldAtTime(now);
    gain.linearRampToValueAtTime(0.035, now + 0.025);
    gain.setValueAtTime(0.035, this.duckUntil);
    gain.linearRampToValueAtTime(0.13, this.duckUntil + 0.3);
  }

  stopEffects() {
    this.epoch++;
    for (const voice of [...this.voices]) this.stopVoice(voice);
    this.lastPlayed.clear();
    this.duckUntil = 0;
    if (this.context && this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(this.context.currentTime);
      this.musicGain.gain.setValueAtTime(0.13, this.context.currentTime);
    }
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.85;
    if (this.muted) {
      this.stopEffects();
      this.music?.pause();
    } else if (!this.paused) this.resume();
    return this.muted;
  }

  pause() {
    this.paused = true;
    this.stopEffects();
    this.music?.pause();
  }

  resume() {
    this.paused = false;
    if (this.unlocked && !this.muted) {
      void this.context?.resume().catch(() => {});
      void this.music?.play().catch(() => {});
    }
  }

  snapshot() {
    return {
      unlocked: this.unlocked, muted: this.muted, paused: this.paused,
      state: this.context?.state ?? "locked", loaded: this.buffers.size, expected: Object.values(CUES).reduce((n, c) => n + c.files.length, 0),
      failed: [...this.failures], active: this.voices.length,
      musicPaused: this.music?.paused ?? true,
      musicGain: this.musicGain?.gain.value ?? 0,
      recent: this.history.map((entry) => ({ ...entry })),
    };
  }
}
