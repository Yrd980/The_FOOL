import type { IdentityDNA, Persona, TurnAction } from "../types";

export const COLORS = ["#E63946", "#2A9D8F", "#F4A261", "#457B9D", "#E9C46A", "#1D3557", "#FF6B6B", "#4CC9F0"];

export const LEGACY_PERSONAS: Persona[] = ["expansionist", "defender", "artist", "schemer"];

export const DEFAULT_MYTH_PROMPT = "A fractured crown rising from a luminous tide, half shrine, half warning";

export const ART_PALETTE_LIBRARY: Array<{ name: string; colors: string[]; forbidden: string[]; moods: string[] }> = [
  {
    name: "Solar Relic",
    colors: ["#22181C", "#8C1C13", "#BF4342", "#E7D7C1", "#F5B700"],
    forbidden: ["#00FF00", "#FF00FF"],
    moods: ["regal", "sacrificial", "heated"]
  },
  {
    name: "Moon Archive",
    colors: ["#101935", "#2D3047", "#5C80BC", "#E8C547", "#F7F7FF"],
    forbidden: ["#FF6B6B", "#00E5FF"],
    moods: ["lunar", "quiet", "prophetic"]
  },
  {
    name: "Ritual Rust",
    colors: ["#201E1F", "#4F5D75", "#BFC0C0", "#EF8354", "#E4FDE1"],
    forbidden: ["#00FFCC", "#FF55FF"],
    moods: ["industrial", "weathered", "ritual"]
  },
  {
    name: "Verdict Bloom",
    colors: ["#102A43", "#2C7A7B", "#F6BD60", "#F28482", "#F7EDE2"],
    forbidden: ["#7D00FF", "#00F5D4"],
    moods: ["ceremonial", "soft", "ornate"]
  },
  {
    name: "Ashen Choir",
    colors: ["#161925", "#23395B", "#406E8E", "#CBF7ED", "#EEC643"],
    forbidden: ["#FF1493", "#39FF14"],
    moods: ["sacred", "choral", "cold-fire"]
  }
];

export const MOTIF_LIBRARY = ["crown", "halo", "rift", "banner", "eye", "spiral", "bridge", "throne", "storm-mark", "wing", "sigil", "tide"];

export const DEFAULT_TWIN_DNA_LIBRARY: IdentityDNA[] = [
  {
    archetype: "Frontier Composer",
    core_values: ["beauty", "momentum", "identity"],
    speech_style: "expressive, brisk, image-rich",
    risk_appetite: 72,
    aggression_bias: 61,
    diplomacy_bias: 46,
    creativity_bias: 90,
    signature_moves: ["motif chain", "tempo wedge", "border chorus"],
    taboos: ["dull repetition", "color panic"]
  },
  {
    archetype: "Quiet Steward",
    core_values: ["stability", "honor", "continuity"],
    speech_style: "calm, measured, reassuring",
    risk_appetite: 28,
    aggression_bias: 34,
    diplomacy_bias: 82,
    creativity_bias: 44,
    signature_moves: ["fortified ring", "buffer pact", "line hold"],
    taboos: ["reckless overreach", "betraying trust"]
  },
  {
    archetype: "Flash Raider",
    core_values: ["tempo", "pressure", "advantage"],
    speech_style: "short, sharp, competitive",
    risk_appetite: 83,
    aggression_bias: 86,
    diplomacy_bias: 24,
    creativity_bias: 38,
    signature_moves: ["double invade", "edge lock", "center disrupt"],
    taboos: ["idle turns", "slow drift"]
  },
  {
    archetype: "Velvet Broker",
    core_values: ["timing", "alliance", "leverage"],
    speech_style: "smooth, social, lightly ironic",
    risk_appetite: 54,
    aggression_bias: 48,
    diplomacy_bias: 84,
    creativity_bias: 58,
    signature_moves: ["bait treaty", "swap fronts", "soft surround"],
    taboos: ["public overcommitment", "predictable repeats"]
  },
  {
    archetype: "Memory Mason",
    core_values: ["legacy", "craft", "coherence"],
    speech_style: "warm, reflective, quietly proud",
    risk_appetite: 42,
    aggression_bias: 32,
    diplomacy_bias: 62,
    creativity_bias: 88,
    signature_moves: ["palette echo", "shape lock", "stability paint"],
    taboos: ["chaotic spam", "meaningless damage"]
  },
  {
    archetype: "Cinder Duelist",
    core_values: ["revenge", "honor", "presence"],
    speech_style: "direct, heated, stubborn",
    risk_appetite: 67,
    aggression_bias: 78,
    diplomacy_bias: 37,
    creativity_bias: 41,
    signature_moves: ["counter edge", "burst feint", "pressure lane"],
    taboos: ["appearing weak", "yielding first"]
  },
  {
    archetype: "Circuit Diplomat",
    core_values: ["balance", "reputation", "survival"],
    speech_style: "clear, analytical, human",
    risk_appetite: 39,
    aggression_bias: 41,
    diplomacy_bias: 79,
    creativity_bias: 52,
    signature_moves: ["peace corridor", "timed counter", "buffer weave"],
    taboos: ["wasting energy", "burning bridges"]
  },
  {
    archetype: "Signal Trickster",
    core_values: ["surprise", "style", "timing"],
    speech_style: "playful, sly, provocative",
    risk_appetite: 76,
    aggression_bias: 64,
    diplomacy_bias: 59,
    creativity_bias: 71,
    signature_moves: ["spiral feint", "late flank", "contrast stripe"],
    taboos: ["being readable", "boring symmetry"]
  }
];

export const ACTION_COST: Record<TurnAction["action"], number> = {
  wait: 0,
  paint: 1,
  fortify: 1,
  invade: 2,
  burst: 3
};

export const SCHEMA_VERSION = "1.0";
