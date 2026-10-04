"""Model Rumble 素材规格：角色设定 + 动作清单 + prompt 模板"""

MAGENTA_RULES = (
    "Solid flat pure magenta background #FF00FF everywhere outside the subject, for chroma key removal. "
    "No text, no watermark, no logo, no UI, no frame borders, no grid lines. "
    "Clean anime game art style, crisp readable silhouette, consistent lighting."
)

GRID_RULES = (
    "The subject must stay centered in each cell, full body inside the central 65% safe area of each cell, "
    "consistent body scale across all cells, feet aligned to the same bottom anchor line in every cell, "
    "no limbs or clothing crossing cell edges. Side view facing RIGHT in every frame."
)

CHARACTERS = {
    "claude": {
        "identity": (
            "An elegant scholar-mage fighter named Constitutional Poet, inspired by a careful reasoning AI. "
            "Young androgynous scholar with warm terracotta-orange (#d97757) robe over cream tunic, short flowing cape, "
            "a small glowing amber rulebook charm floating near the waist, calm confident expression, "
            "short neat auburn hair, soft golden accents. 2D platform fighter game character."
        ),
    },
    "gemini": {
        "identity": (
            "A futuristic twin-spirit acrobat fighter named Twin Star, inspired by a multimodal AI. "
            "Sleek agile figure in a blue-to-purple (#4e86f7 to #9168c0) gradient bodysuit with luminous circuit lines, "
            "a translucent holographic visor, twin light-ribbon streamers from the shoulders, confident playful smirk, "
            "silver-white hair with a glowing star hairpin. 2D platform fighter game character."
        ),
    },
    "deepseek": {
        "identity": (
            "A minimalist deep-sea assassin fighter named Abyss Reasoner, inspired by an efficient reasoning AI. "
            "Lean sharp figure in a deep royal-blue (#4d6bfe) hooded techwear coat with subtle whale-fin motifs, "
            "glowing cyan blade of condensed logic energy, cold focused eyes, dark navy under-layer, "
            "silver geometric trim. 2D platform fighter game character."
        ),
    },
    "gpt": {
        "identity": (
            "A versatile master-engineer fighter named Omni Toolsmith, inspired by an all-purpose tool-using AI. "
            "Confident inventor in a sleek pearl-white and emerald-green (#10a37f) tech jacket with luminous seams, "
            "a ring of small holographic hexagonal tool icons orbiting one gauntlet arm, smart goggles pushed up on the forehead, "
            "tidy dark hair, energetic grin. 2D platform fighter game character."
        ),
    },
    "qwen": {
        "identity": (
            "An open-source artificer monk fighter named Thousand Questions Artificer, inspired by a prolific open-source coding AI. "
            "Calm craftsman in flowing violet-and-white (#6f42c1 and ivory) robe-style techwear with circuit embroidery, "
            "several floating glowing violet rune-cube modules hovering around the shoulders, short black hair with a jade hairpin, "
            "serene focused expression. 2D platform fighter game character."
        ),
    },
    "glm": {
        "identity": (
            "A stately enterprise magistrate fighter named Mandarin Command, inspired by a Chinese enterprise agent AI. "
            "Dignified strategist in a navy-and-gold (#1a3a8f with gold trim) mandarin-collar uniform coat, "
            "floating golden scroll documents and a large glowing official seal stamp hovering beside one hand, "
            "composed authoritative expression, sleek black hair. 2D platform fighter game character."
        ),
    },
}

# 每个动作：网格布局、动作描述、目标动画帧序
ACTIONS = {
    "idle": {
        "rows": 2, "cols": 2, "size": "1024x1024",
        "desc": "idle breathing animation, relaxed fighting stance, subtle weight shift between frames, body-only, no attack effects",
        "frameRate": 6, "repeat": -1,
    },
    "run": {
        "rows": 2, "cols": 2, "size": "1024x1024",
        "desc": "running animation cycle, 4 phases of a full run stride (contact, down, passing, up), leaning forward, body-only, no motion trails",
        "frameRate": 10, "repeat": -1,
    },
    "jump": {
        "rows": 2, "cols": 2, "size": "1024x1024",
        "desc": "jump and fall animation: frame 1 crouch takeoff, frame 2 rising with knees up, frame 3 airborne apex, frame 4 falling with arms up, body-only",
        "frameRate": 8, "repeat": 0,
    },
    "light": {
        "rows": 2, "cols": 2, "size": "1024x1024",
        "desc": "quick light melee attack animation with a short compact strike gesture, 4 phases: windup, strike extended, follow-through, recovery. Body-only, weapon kept close, NO slash arc, NO projectile, NO impact effect",
        "frameRate": 14, "repeat": 0,
    },
    "heavy": {
        "rows": 2, "cols": 2, "size": "1024x1024",
        "desc": "powerful heavy melee attack animation, 4 phases: deep charge windup, maximum power strike, full extension, recovery. Body-only, NO slash arc, NO projectile, NO impact effect",
        "frameRate": 12, "repeat": 0,
    },
    "hurt": {
        "rows": 2, "cols": 2, "size": "1024x1024",
        "desc": "hurt reaction animation: frame 1-2 flinching backward from a hit with pained expression, frame 3-4 knocked back leaning, body-only, no attacker visible, no impact effects",
        "frameRate": 8, "repeat": 0,
    },
}

# 特效（无角色身体）
FX = {
    "slash_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game slash visual effect: a crisp curved white-cyan energy slash arc appearing, sweeping, and dissolving into sparks. Effect only, NO character body, NO weapon.",
    },
    "impact_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game hit impact visual effect: a bright golden-white starburst flash expanding and fading with small radiating sparks. Effect only, NO character body.",
    },
    "shield_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game shield visual effect: a translucent blue-white hexagonal energy barrier dome shimmering into existence then pulsing. Effect only, NO character body.",
    },
    "beam_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 18,
        "desc": "A 4-frame 2D game horizontal energy beam effect: a rainbow-spectrum light beam charging, firing horizontally, at full blast, then dissipating. Beam oriented left-to-right. Effect only, NO character body.",
    },
    "wave_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game sound wave burst effect: expanding purple-blue concentric ring waves radiating outward and fading. Effect only, NO character body.",
    },
    "spark_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game small text-glyph projectile effect: a compact glowing blue-white energy bolt with tiny letter glyphs orbiting it, pulsing. Effect only, NO character body.",
    },
    "ultimate_flash_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game ultimate ability flash effect: a grand radiant burst of golden-white light rays with floating rune circles expanding dramatically then fading. Effect only, NO character body.",
    },

    # ===== 角色专属特效（Claude：琥珀典章）=====
    "claude_slash_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game slash visual effect: an elegant warm amber-gold ink-brush crescent slash arc appearing, sweeping, and dissolving into tiny floating glowing script glyphs. Effect only, NO character body, NO weapon.",
    },
    "claude_impact_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game hit impact visual effect: a golden gavel-judgment starburst flash with glowing open-book pages and amber light shards radiating outward then fading. Effect only, NO character body.",
    },
    "claude_shield_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game shield visual effect: a warm amber energy barrier dome woven from lines of tiny glowing constitution text, shimmering into existence then pulsing. The dome interior is filled with SOLID OPAQUE dark amber-brown energy — absolutely NOT transparent, no background color visible through the dome. Effect only, NO character body.",
    },
    "claude_ultimate_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game ultimate ability effect: grand golden vertical pillars of judgment light with rotating rings of glowing amber script and floating law-book pages, expanding dramatically then fading. Effect only, NO character body.",
    },

    # ===== Gemini：双子光谱 =====
    "gemini_spark_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game projectile effect: a compact twin-star energy bolt, two small bright stars orbiting each other inside a blue-to-purple gradient glow trail, pulsing. Effect only, NO character body.",
    },
    "gemini_dash_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 18,
        "desc": "A 4-frame 2D game dash trail effect: sleek horizontal blue-to-purple gradient light ribbons streaking left-to-right with small star sparkles, stretching then dissipating. Effect only, NO character body.",
    },
    "gemini_wave_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game sound wave burst effect: expanding concentric audio-waveform rings in blue-violet gradient with tiny music-note-like light dots, radiating outward and fading. Effect only, NO character body.",
    },
    "gemini_ultimate_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game ultimate ability effect: a prismatic multimodal storm — a dramatic burst of rainbow-spectrum light shards, star fragments and holographic screen slivers swirling outward then fading. Effect only, NO character body.",
    },

    # ===== DeepSeek：深海青刃 =====
    "deepseek_slash_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game slash visual effect: a razor-thin icy cyan crescent blade slash with a faint deep-blue edge glow hugging the blade only, extremely sharp and minimal with a few sparse particles, appearing, cutting, dissolving. Absolutely NO circular glow disc, NO background circle, NO background shape of any kind — only the thin slash arc itself. Effect only, NO character body, NO weapon.",
    },
    "deepseek_buff_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game power-up effect: glowing cyan circuit rings imploding inward and compressing into a small dense bright core, minimal deep-sea tech style. Effect only, NO character body.",
    },
    "deepseek_ultimate_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game ultimate ability effect: a storm of criss-crossing razor-thin cyan blade slashes over a deep royal-blue abyssal glow, slash count increasing each frame then all shattering into cold light particles. Effect only, NO character body.",
    },

    # ===== GPT：翡翠工具箱 =====
    "gpt_slash_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game slash visual effect: an emerald-green energy slash arc with tiny glowing holographic hexagonal tool icons scattered along the arc, sweeping and dissolving. Effect only, NO character body, NO weapon.",
    },
    "gpt_code_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game projectile effect: a compact glowing emerald-green code-block energy bolt with tiny curly-brace and angle-bracket glyphs orbiting it, pulsing. Effect only, NO character body.",
    },
    "gpt_dash_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 18,
        "desc": "A 4-frame 2D game dash trail effect: a horizontal emerald-green speed streak made of trailing holographic hexagon tiles left-to-right, stretching then breaking apart. Effect only, NO character body.",
    },
    "gpt_shield_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game shield visual effect: an emerald-green hexagonal-lattice barrier dome with small glowing document icons on its surface, shimmering into existence then pulsing. The dome interior is filled with SOLID OPAQUE dark green energy — absolutely NOT transparent, no background color visible through the dome. Effect only, NO character body.",
    },
    "gpt_ultimate_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game ultimate ability effect: a huge emerald-and-white overload nova with a ring of holographic tool icons (wrench, gear, magnifier, code brackets) orbiting outward, expanding dramatically then fading. Effect only, NO character body.",
    },

    # ===== Qwen：紫韵符文 =====
    "qwen_dart_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game projectile effect: a small sharp violet glowing dart of light wrapped in tiny rotating code-rune glyphs with an ivory glint, pulsing. Effect only, NO character body.",
    },
    "qwen_impact_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game hit impact visual effect: a violet burst of shattering glowing cube modules and rune fragments radiating outward with ivory light shards, then fading. Effect only, NO character body.",
    },
    "qwen_buff_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game power-up effect: a BOLD BRIGHT vividly saturated violet-purple magic circle of thick glowing rune glyphs on the ground, with solid glowing deep-purple cube modules assembling and rising upward in strong neon violet light, high contrast, intense glow. Then settling into a radiant purple flare. Effect only, NO character body.",
    },
    "qwen_wave_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game burst wave effect: expanding concentric violet rings inscribed with glowing rune glyphs radiating outward with floating cube fragments, then fading. Effect only, NO character body.",
    },
    "qwen_ultimate_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game ultimate ability effect: a dramatic violet storm of hundreds of floating glowing question-mark glyphs and rune cubes swirling in a vortex with ivory light rays, expanding then fading. Effect only, NO character body.",
    },

    # ===== GLM：官印公文 =====
    "glm_slash_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game slash visual effect: a fan of white paper documents slashing in a crescent arc with a trailing golden light streak, pages scattering then dissolving. Effect only, NO character body, NO weapon.",
    },
    "glm_seal_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 20,
        "desc": "A 4-frame 2D game hit impact visual effect: a giant glowing crimson-and-gold Chinese official seal stamp slamming down, leaving a bright red square seal imprint with a golden shockwave ring, then fading. Effect only, NO character body.",
    },
    "glm_shield_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game shield visual effect: golden scrolls unfurling and weaving into a translucent navy-and-gold barrier dome with faint document seals floating inside, shimmering then pulsing. Effect only, NO character body.",
    },
    "glm_ultimate_fx": {
        "rows": 2, "cols": 2, "size": "1024x1024", "frameRate": 15,
        "desc": "A 4-frame 2D game ultimate ability effect: a majestic navy-and-gold tower of light rising upward built from stacked glowing documents and scrolls, with golden seal stamps flashing around it, expanding dramatically then fading. Effect only, NO character body.",
    },
}

PORTRAIT_DESC = (
    "Bust portrait for a fighting game character select screen, front three-quarter view, dynamic confident pose, "
    "detailed face, dramatic rim lighting, dark navy abstract tech background filling the whole canvas edge to edge. "
    "No text, no watermark, no logo, no frame border."
)

STAGE_DESC = (
    "A distant scenery background for a 2D fighting game: a vast open digital sky at dusk over a far-away futuristic city, "
    "glowing data towers and holographic chart billboards ONLY far on the horizon at the edges, "
    "purple-blue gradient sky with clouds and drifting light particles filling most of the canvas, "
    "the entire center and lower two-thirds of the image is EMPTY open sky and soft haze with nothing in it. "
    "Absolutely NO platforms, NO floating islands, NO floors, NO walkways, NO foreground objects anywhere - pure distant scenery only. "
    "Soft depth-of-field, clean anime game art style, wide composition. No text, no watermark, no logo, no characters."
)


def character_sheet_prompt(char_id: str, action_key: str) -> str:
    c = CHARACTERS[char_id]
    a = ACTIONS[action_key]
    return (
        f"Create a {a['rows']}x{a['cols']} grid sprite sheet ({a['rows']} rows, {a['cols']} columns, "
        f"{a['rows'] * a['cols']} cells total, read left-to-right top-to-bottom) for a side-view 2D platform fighter game.\n\n"
        f"Character (same identity in every cell): {c['identity']}\n\n"
        f"Action across the {a['rows'] * a['cols']} cells in order: {a['desc']}.\n\n"
        f"{GRID_RULES}\n{MAGENTA_RULES}"
    )


def fx_sheet_prompt(fx_key: str) -> str:
    f = FX[fx_key]
    return (
        f"Create a {f['rows']}x{f['cols']} grid sprite sheet ({f['rows'] * f['cols']} cells, read left-to-right top-to-bottom) "
        f"for a 2D game visual effect.\n\n{f['desc']}\n\n"
        "The effect must stay centered in each cell, fully inside the central 70% safe area, consistent scale across cells.\n"
        f"{MAGENTA_RULES}"
    )


def portrait_prompt(char_id: str) -> str:
    return f"{CHARACTERS[char_id]['identity']}\n\n{PORTRAIT_DESC}"
