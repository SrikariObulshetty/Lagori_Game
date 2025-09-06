/**
 * LagoriGame.tsx
 * सभी गेम लॉजिक ज्यों का त्यों रखा गया है ✅
 * केवल टेक्स्ट/लेबल्स/इंस्ट्रक्शन हिंदी में अनुवादित हैं ✅
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Pause, Play, RotateCw } from "lucide-react";
import YouTube from "react-youtube";

/** 2D vector */
interface Vec2 {
  x: number;
  y: number;
}

/** Level identifier */
export type LevelKey = "beginner" | "intermediate" | "advanced";





export interface LevelConfig {
  /** Display name */
  name: string;
  /** Number of stones required to stack to win */
  stones: number;
  /** Max throw attempts in the throw phase */
  attempts: number;
  /** Opponent movement speed (pixels/second) */
  opponentSpeed: number;
  /** Player movement speed (pixels/second) */
  playerSpeed: number;
}


/** Game phases */
type Phase = "परिचय" | "निशाना" | "खींचना" | "उड़ान" | "पुनर्निर्माण" | "जीत" | "हार";



/** लेवल कॉन्फ़िग */
export const LEVELS: Record<LevelKey, LevelConfig> = {
  beginner: {
    name: "शुरुआती",
    stones: 5,
    attempts: 3,
    opponentSpeed: 90,
    playerSpeed: 160,
  },
  intermediate: {
    name: "मध्यम",
    stones: 7,
    attempts: 3,
    opponentSpeed: 120,
    playerSpeed: 165,
  },
  advanced: {
    name: "उन्नत",
    stones: 9,
    attempts: 2,
    opponentSpeed: 150,
    playerSpeed: 170,
  },
};


/** Entity representation for player/opponent/ball */
interface CircleEntity {
  pos: Vec2;
  radius: number;
  color: string;
}

/** Game metrics stored in a ref so updates won't re-render every frame */
interface Metrics {
  score: number;
  attemptsLeft: number;
  stonesPlaced: number;
  stonesTotal: number;
}

/** Canvas sizes */
const BASE_W = 900;
const BASE_H = 540;

/** Career → YouTube map (put your real video IDs here) */
const CAREER_VIDEOS: Record<string, string> = {
  डॉक्टर: "djbtjiFRSeM",
  इंजीनियर: "TamDorsp6Dw",
  "आईएएस अधिकारी": "VsUoke20h_A",
  "शिक्षक/अध्यापक": "SKei_49B5eQ",
  "चार्टर्ड अकाउंटेंट": "jKQqmBQCsu8",
 "अंतरिक्ष यात्री": "14fXq-2gSAE",
  अभिनेता: "VAhSakREFyo",
  क्रिकेटर: "Iu8Vy5aW_O0",
  उद्यमी: "2Oc_ykbJqlA",
  "बैंक प्रबंधक": "eRd0-8vPrSQ",
};

/**
 * Utility functions (math + collisions)
 */
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const len = (v: Vec2) => Math.hypot(v.x, v.y);
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s });
const norm = (v: Vec2): Vec2 => {
  const l = len(v);
  return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
};
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Returns true if the line segment p0-p1 intersects the circle at center c with radius r.
 */
function segmentCircleIntersect(
  p0: Vec2,
  p1: Vec2,
  c: Vec2,
  r: number
): boolean {
  const d = sub(p1, p0);
  const f = sub(p0, c);
  const a = d.x * d.x + d.y * d.y;
  const b = 2 * (f.x * d.x + f.y * d.y);
  const cc = f.x * f.x + f.y * f.y - r * r;
  let discriminant = b * b - 4 * a * cc;
  if (discriminant < 0) return false;
  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

/**
 * LagoriGame component
 */
export default function LagoriGame({ levelKey }: { levelKey: LevelKey }) {
  const level = LEVELS[levelKey];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Phase and UI flags
  const [phase, setPhase] = useState<Phase>("परिचय");
  const [paused, setPaused] = useState<boolean>(false);
  const [roundSeed, setRoundSeed] = useState<number>(Date.now());

    // Track which D-pad direction is being held
  const heldDir = useRef<"up" | "down" | "left" | "right" | null>(null);


  // Career overlay state
  const [careerModalOpen, setCareerModalOpen] = useState<boolean>(false);
  const [selectedCareer, setSelectedCareer] = useState<string | null>(null);
  const [classInput, setClassInput] = useState<string>("");

  // Roadmap + gating state
  const [roadmapData, setRoadmapData] = useState<any | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [errorRoadmap, setErrorRoadmap] = useState<string | null>(null);
  const [hasViewedRoadmap, setHasViewedRoadmap] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);

  // Derived constants
  const world = useMemo(
    () => ({
      w: BASE_W,
      h: BASE_H,
      pilePos: { x: BASE_W / 2, y: BASE_H / 2 } as Vec2,
      pileRadius: 28,
      placeRange: 46,
      tagRange: 22,
      ballFriction: 0.985,
      ballStopSpeed: 20,
      maxThrowPower: 600,
      throwPowerScale: 3.0,
    }),
    []
  );

  // ✅ Add a small helper for on-screen movement
  const handleMove = (dir: "up" | "down" | "left" | "right") => {
    if (phase !== "पुनर्निर्माण") return;
    const speed = level.playerSpeed * 0.1; // small step per click
    if (dir === "up") player.current.pos.y = Math.max(10, player.current.pos.y - speed);
    if (dir === "down") player.current.pos.y = Math.min(BASE_H - 10, player.current.pos.y + speed);
    if (dir === "left") player.current.pos.x = Math.max(10, player.current.pos.x - speed);
    if (dir === "right") player.current.pos.x = Math.min(BASE_W - 10, player.current.pos.x + speed);
  };

  // ✅ Place stone button handler
  const handlePlaceStone = () => {
    tryPlaceStone();
  };

  // Entities
  const player = useRef<CircleEntity>({
    pos: { x: 130, y: BASE_H - 90 },
    radius: 14,
    color: "#2563eb",
  });

  const opponent = useRef<CircleEntity>({
    pos: { x: BASE_W - 120, y: 80 },
    radius: 14,
    color: "#dc2626",
  });

  const ball = useRef<CircleEntity>({
    pos: { x: player.current.pos.x, y: player.current.pos.y },
    radius: 8,
    color: "#111827",
  });
  const ballVel = useRef<Vec2>({ x: 0, y: 0 });
  const ballActive = useRef<boolean>(false);

  // Pile state
  const pileCollapsed = useRef<boolean>(false);

  // Metrics
  const metrics = useRef<Metrics>({
    score: 0,
    attemptsLeft: level.attempts,
    stonesPlaced: 0,
    stonesTotal: level.stones,
  });

  // Input state
  const keys = useRef<Record<string, boolean>>({});
  const dragging = useRef<boolean>(false);
  const dragStart = useRef<Vec2>({ x: 0, y: 0 });
  const dragCurrent = useRef<Vec2>({ x: 0, y: 0 });

  /** Reset everything for a new round */
  const resetRound = (keepScore = true) => {
    metrics.current.attemptsLeft = level.attempts;
    metrics.current.stonesPlaced = 0;
    metrics.current.stonesTotal = level.stones;
    if (!keepScore) metrics.current.score = 0;

    // Entities
    player.current.pos = { x: 130, y: BASE_H - 90 };
    opponent.current.pos = randomEdgeSpawn(BASE_W, BASE_H);
    ball.current.pos = { ...player.current.pos };
    ballVel.current = { x: 0, y: 0 };
    ballActive.current = false;
    pileCollapsed.current = false;

    // Modal + gating resets
    setCareerModalOpen(false);
    setSelectedCareer(null);
    setClassInput("");
    setRoadmapData(null);
    setErrorRoadmap(null);
    setHasViewedRoadmap(false);
    setVideoWatched(false);

    setPhase("निशाना");
    setRoundSeed(Date.now());
  };

  /** Random spawn point along the border for opponent */
  function randomEdgeSpawn(w: number, h: number): Vec2 {
    const side = Math.floor(Math.random() * 4);
    const margin = 20;
    switch (side) {
      case 0:
        return { x: margin, y: Math.random() * (h - 2 * margin) + margin };
      case 1:
        return { x: w - margin, y: Math.random() * (h - 2 * margin) + margin };
      case 2:
        return { x: Math.random() * (w - 2 * margin) + margin, y: margin };
      default:
        return {
          x: Math.random() * (w - 2 * margin) + margin,
          y: h - margin,
        };
    }
  }

  /** Start the first round */
  const startGame = () => {
    metrics.current.score = 0;
    resetRound(false);
  };

  /** Keyboard handlers */
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.code === "Space" && phase === "पुनर्निर्माण") {
        e.preventDefault();
        tryPlaceStone();
      }
      if (e.key.toLowerCase() === "p") setPaused((p) => !p);
    };
    const onUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [phase]);

  /** Pointer handling */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getLocal = (evt: PointerEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((evt.clientX - rect.left) / rect.width) * BASE_W,
        y: ((evt.clientY - rect.top) / rect.height) * BASE_H,
      };
    };

    const down = (e: PointerEvent) => {
      if (phase !== "निशाना") {
        if (phase === "पुनर्निर्माण") tryPlaceStone();
        return;
      }
      dragging.current = true;
      dragStart.current = { ...player.current.pos };
      dragCurrent.current = getLocal(e);
      setPhase("खींचना");
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragCurrent.current = getLocal(e);
    };
    const up = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      canvas.releasePointerCapture(e.pointerId);
      const dir = sub(dragCurrent.current, dragStart.current);
      const power = clamp(
        len(dir) * world.throwPowerScale,
        0,
        world.maxThrowPower
      );
      const v = mul(norm(dir), power);
      ball.current.pos = { ...player.current.pos };
      ballVel.current = v;
      ballActive.current = true;
      setPhase("उड़ान");
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, [phase, world.throwPowerScale, world.maxThrowPower, roundSeed]);

  /** Try placing a stone */
  const tryPlaceStone = () => {
    if (phase !== "पुनर्निर्माण") return;
    const near = dist(player.current.pos, world.pilePos) <= world.placeRange;
    if (!near) return;
    if (metrics.current.stonesPlaced < metrics.current.stonesTotal) {
      metrics.current.stonesPlaced += 1;
      if (metrics.current.stonesPlaced >= metrics.current.stonesTotal) {
        metrics.current.score += 50;
        setPhase("जीत");
        // Show the full-screen career modal immediately after winning
        setCareerModalOpen(true);
      }
    }
  };

  /** Game loop */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = BASE_W * dpr;
    canvas.height = BASE_H * dpr;
    canvas.style.width = "100%";
    canvas.style.aspectRatio = `${BASE_W}/${BASE_H}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(50, now - last) / 1000;
      last = now;
      if (!paused) {
        update(dt);
      }
      draw(ctx);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paused, phase, levelKey, roundSeed]);

  /** Per-frame update */
  const update = (dt: number) => {
    if (phase === "पुनर्निर्माण") {
      const move = { x: 0, y: 0 };
      if (keys.current["w"] || keys.current["arrowup"]) move.y -= 1;
      if (keys.current["s"] || keys.current["arrowdown"]) move.y += 1;
      if (keys.current["a"] || keys.current["arrowleft"]) move.x -= 1;
      if (keys.current["d"] || keys.current["arrowright"]) move.x += 1;
      const v = norm(move);
      player.current.pos.x = clamp(
        player.current.pos.x + v.x * level.playerSpeed * dt,
        10,
        BASE_W - 10
      );
      player.current.pos.y = clamp(
        player.current.pos.y + v.y * level.playerSpeed * dt,
        10,
        BASE_H - 10
      );

            // On-screen button continuous movement
      if (heldDir.current) {
        if (heldDir.current === "up") player.current.pos.y = Math.max(10, player.current.pos.y - level.playerSpeed * dt);
        if (heldDir.current === "down") player.current.pos.y = Math.min(BASE_H - 10, player.current.pos.y + level.playerSpeed * dt);
        if (heldDir.current === "left") player.current.pos.x = Math.max(10, player.current.pos.x - level.playerSpeed * dt);
        if (heldDir.current === "right") player.current.pos.x = Math.min(BASE_W - 10, player.current.pos.x + level.playerSpeed * dt);
      }



      const dir = norm(sub(player.current.pos, opponent.current.pos));
      opponent.current.pos.x += dir.x * level.opponentSpeed * dt;
      opponent.current.pos.y += dir.y * level.opponentSpeed * dt;

      if (dist(player.current.pos, opponent.current.pos) <= world.tagRange) {
        setPhase("हार");
      }
    }

    if (phase === "उड़ान" && ballActive.current) {
      const prev = { ...ball.current.pos };
      ball.current.pos.x += ballVel.current.x * dt;
      ball.current.pos.y += ballVel.current.y * dt;
      ballVel.current.x *= world.ballFriction;
      ballVel.current.y *= world.ballFriction;

      if (
        !pileCollapsed.current &&
        segmentCircleIntersect(
          prev,
          ball.current.pos,
          world.pilePos,
          world.pileRadius
        )
      ) {
        pileCollapsed.current = true;
        metrics.current.score += 10;
        opponent.current.pos = randomEdgeSpawn(BASE_W, BASE_H);
        setPhase("पुनर्निर्माण");
        ballActive.current = false;
      }

      const speed = len(ballVel.current);
      const out =
        ball.current.pos.x < -50 ||
        ball.current.pos.x > BASE_W + 50 ||
        ball.current.pos.y < -50 ||
        ball.current.pos.y > BASE_H + 50;
      if (speed < world.ballStopSpeed || out) {
        ballActive.current = false;
        if (!pileCollapsed.current) {
          metrics.current.attemptsLeft -= 1;
          if (metrics.current.attemptsLeft > 0) {
            setPhase("निशाना");
          } else {
            setPhase("हार");
          }
        } else {
          setPhase("पुनर्निर्माण");
        }
      }
    }
  };

  /** Drawing functions */
  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, BASE_W, BASE_H);
    ctx.fillStyle = "#e6f4ea";
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, BASE_W - 16, BASE_H - 16);

    drawPile(ctx);
    drawCircle(ctx, player.current.pos, player.current.radius, player.current.color);
    if (phase === "पुनर्निर्माण" || phase === "हार") {
      drawCircle(ctx, opponent.current.pos, opponent.current.radius, opponent.current.color);
    }
    if (phase === "खींचना") {
      const start = player.current.pos;
      const end = dragCurrent.current;
      ctx.strokeStyle = "#1f2937";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      drawCircle(ctx, end, 4, "#111827");
    }
    if (phase === "उड़ान" && ballActive.current) {
      drawCircle(ctx, ball.current.pos, ball.current.radius, ball.current.color);
    }
    drawHUD(ctx);
  };

  const drawPile = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.globalAlpha = 0.15;
    drawCircle(ctx, world.pilePos, world.pileRadius + 8, "#111827");
    ctx.restore();

    if (!pileCollapsed.current) {
      const layers = Math.min(7, metrics.current.stonesTotal);
      for (let i = 0; i < layers; i++) {
        const r = 14 + (i % 2) * 1;
        const y = world.pilePos.y - i * 3;
        drawCircleStroke(ctx, { x: world.pilePos.x, y }, r, "#6b7280", "#d1d5db");
      }
    }
  };

  const drawCircle = (ctx: CanvasRenderingContext2D, pos: Vec2, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawCircleStroke = (
    ctx: CanvasRenderingContext2D,
    pos: Vec2,
    r: number,
    stroke: string,
    fill: string
  ) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };







/** HUD ड्रॉ */
const drawHUD = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = "#111827";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`अंक: ${metrics.current.score}`, 16, 26);
  ctx.fillText(`प्रयास: ${metrics.current.attemptsLeft}`, 16, 50);
  ctx.fillText(`चरण: ${phase}`, 16, 74);
  ctx.textAlign = "right";
  ctx.fillText(level.name, BASE_W - 16, 26);
};


/** Cleanup pointer lock on unmount */
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /**
   * Full-screen Career Modal (shown after winning)
   * - Scrollable content
   * - Next Round button (disabled until roadmap viewed + video watched)
   */

/** करियर मॉडल */
const renderCareerModal = () => {
  if (!careerModalOpen) return null;
  const videoId = selectedCareer ? CAREER_VIDEOS[selectedCareer] : undefined;
  const nextEnabled = hasViewedRoadmap && videoWatched;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-stretch bg-black/60">
      {/* Full-screen modal container */}
      <div className="mx-auto my-0 h-screen w-screen p-4 md:p-6 lg:p-8">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-200">
          {/* हेडर */}
          <div className="flex items-center justify-between gap-4 border-b p-4 md:p-5">
            <div>
              <h2 className="text-xl font-bold text-green-600">
                शानदार 👏 आपने जीत हासिल की 🎉
              </h2>
              <p className="text-sm text-gray-600">
                एक करियर चुनें, रोडमैप देखें और वीडियो देखें ताकि अगला राउंड
                अनलॉक हो सके।
              </p>
            </div>
            <Button variant="outline" onClick={() => setCareerModalOpen(false)}>
              बंद करें
            </Button>
          </div>

          {/* बॉडी */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {/* Career & Class selectors + Fetch */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  करियर
                </label>
                <select
                  className="w-full rounded border p-2"
                  value={selectedCareer ?? ""}
                  onChange={(e) => {
                    setSelectedCareer(e.target.value || null);
                    setVideoWatched(false);
                  }}
                >
                  <option value="">करियर चुनें</option>
                  {Object.keys(CAREER_VIDEOS).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  आपकी कक्षा
                </label>
                <input
                  type="number"
                  className="w-full rounded border p-2"
                  value={classInput}
                  onChange={(e) => setClassInput(e.target.value)}
                  placeholder="कक्षा दर्ज करें (6–12)"
                />
              </div>

               <div className="flex items-end">
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (!selectedCareer || !classInput) return;
                      setLoadingRoadmap(true);
                      setErrorRoadmap(null);
                      setRoadmapData(null);

                      console.log("Selected career:", selectedCareer);
                      console.log("Selected class:", classInput);

                      fetch(
                        `http://localhost:5000/api/roadmap?career=${encodeURIComponent(
                          selectedCareer
                        )}&class=${classInput}`
                      )
                        .then((res) => {
                          if (!res.ok) throw new Error("Failed to fetch roadmap");
                          return res.json();
                        })
                        .then((data) => {
                          setRoadmapData(data);
                          setHasViewedRoadmap(true); // ✅ mark viewed once we fetch a roadmap
                          setVideoWatched(false); // must watch again each round
                          // Scroll roadmap into view
                          const el = document.getElementById("career-roadmap");
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        })
                        .catch((err) => setErrorRoadmap(err.message))
                        .finally(() => setLoadingRoadmap(false));
                    }}
                  >
                   मार्गदर्शन करें
                  </Button>
                </div>
              </div>


            {/* रोडमैप सेक्शन */}
            <div id="career-roadmap" className="mt-4 rounded-lg border bg-white/90">
              <div className="max-h-[40vh] overflow-auto p-3">
                {loadingRoadmap && (
                  <div className="text-sm text-blue-600">रोडमैप लोड हो रहा है...</div>
                )}
                {errorRoadmap && (
                  <div className="text-sm text-red-600">⚠ {errorRoadmap}</div>
                )}
                 {roadmapData && roadmapData.roadmap && (
                    <div className="space-y-3">
                      {roadmapData.roadmap.map((stg: any, i: number) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="mb-1 font-semibold">{stg.stage_title}</div>
                          <p className="mb-2 text-sm text-gray-700">{stg.goal}</p>
                          <ul className="list-disc pl-4 text-sm">
                            {stg.key_points?.map((it: string, k: number) => (
                              <li key={k}>{it}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                {!loadingRoadmap &&
                  !errorRoadmap &&
                  (!roadmapData || !roadmapData.roadmap) && (
                    <div className="text-sm text-gray-700">
                      इस करियर के लिए कोई रोडमैप नहीं मिला।
                    </div>
                  )}
              </div>
            </div>

            {/* वीडियो सेक्शन */}
            {selectedCareer && CAREER_VIDEOS[selectedCareer] && (
              <div className="mt-6">
                <h3 className="mb-2 font-semibold">यह छोटा वीडियो देखें:</h3>
                <div className="w-full max-w-4xl">
                  <YouTube
                    videoId={CAREER_VIDEOS[selectedCareer]}
                    opts={{
                      height: "360",
                      width: "100%",
                      playerVars: { autoplay: 0 },
                    }}
                    onEnd={() => setVideoWatched(true)}
                  />
                </div>
                {!videoWatched && (
                  <p className="mt-2 text-sm text-gray-600">
                    अगला राउंड सक्षम करने के लिए अंत तक देखें।
                  </p>
                )}
              </div>
            )}
          </div>

          {/* फुटर */}
          <div className="flex flex-col items-start gap-2 border-t p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-gray-600">
              स्थिति: रोडमैप देखा{" "}
              <b>{hasViewedRoadmap ? "✅" : "❌"}</b> • वीडियो पूरा{" "}
              <b>{videoWatched ? "✅" : "❌"}</b>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCareerModalOpen(false)}>
                बंद करें
              </Button>
              <Button
                onClick={() => resetRound(true)}
                disabled={!(hasViewedRoadmap && videoWatched)}
                title={
                  hasViewedRoadmap && videoWatched
                    ? "अगला राउंड शुरू करें"
                    : "रोडमैप देखें और वीडियो पूरा करें"
                }
              >
                <RotateCw className="mr-2 h-4 w-4" /> अगला राउंड
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** परिचय / Win / Lose overlays में भी हिंदी */
 return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-auto block rounded-lg border" />

      {/* Intro Overlay */}
      {phase === "परिचय" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80">
          <h1 className="mb-4 text-3xl font-bold">लगोरी: सात पत्थर</h1>
          <Button onClick={startGame}>
            <Play className="mr-2 h-4 w-4" /> शुरू करें
          </Button>
        </div>
      )}

      {/* Win Overlay */}
      {phase === "जीत" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-green-100/80">
          <h2 className="mb-2 text-2xl font-bold">"आप जीत गए!"</h2>
          <p className="mb-4">स्कोर: {metrics.current.score}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setCareerModalOpen(true)}
              variant="outline"
            >
              करियर रोडमैप देखें
            </Button>
            <Button
              onClick={() => resetRound(true)}
              disabled={!(hasViewedRoadmap && videoWatched)}
              title={
                hasViewedRoadmap && videoWatched
                  ? "अगला राउंड शुरू करें"
                  : "रोडमैप देखें और वीडियो पूरा करें ताकि सक्षम हो सके"
              }
            >
              <RotateCw className="mr-2 h-4 w-4" /> अगला राउंड
            </Button>
          </div>
        </div>
      )}

      {/* Lose Overlay */}
      {phase === "हार" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-100/80">
          <h2 className="mb-2 text-2xl font-bold">आप हार गए!</h2>
          <p className="mb-4">स्कोर: {metrics.current.score}</p>
          <Button onClick={() => resetRound(false)}>
            <RotateCw className="mr-2 h-4 w-4" /> पुनः प्रारंभ करें
          </Button>
        </div>
      )}

      {/* Full-screen Career Modal */}
      {renderCareerModal()}

      {/* Controls */}
      <div className="absolute bottom-3 right-3 z-30 flex gap-2">
        <Button variant="outline" onClick={() => setPaused((p) => !p)}>
          {paused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
          {paused ? "जारी रखें" : "रोकें"}
        </Button>
      </div>

      {/* ✅ On-screen movement + action buttons for mobile */}
      {phase === "पुनर्निर्माण" && (
        <div className="absolute bottom-3 left-3 z-30 flex flex-col items-center gap-2">
          {/* Up */}
          <Button
            size="sm"
            onMouseDown={() => (heldDir.current = "up")}
            onTouchStart={() => (heldDir.current = "up")}
            onMouseUp={() => (heldDir.current = null)}
            onMouseLeave={() => (heldDir.current = null)}
            onTouchEnd={() => (heldDir.current = null)}
          >
          ↑
          </Button>

          <div className="flex gap-2">
            <Button
              size="sm"
              onMouseDown={() => (heldDir.current = "left")}
              onTouchStart={() => (heldDir.current = "left")}
              onMouseUp={() => (heldDir.current = null)}
              onMouseLeave={() => (heldDir.current = null)}
              onTouchEnd={() => (heldDir.current = null)}
            >
            ←
            </Button>
            <Button size="sm" onClick={handlePlaceStone}>"पत्थर रखें"</Button>
            <Button
              size="sm"
              onMouseDown={() => (heldDir.current = "right")}
              onTouchStart={() => (heldDir.current = "right")}
              onMouseUp={() => (heldDir.current = null)}
              onMouseLeave={() => (heldDir.current = null)}
              onTouchEnd={() => (heldDir.current = null)}
            >
            →
            </Button>
          </div>
          {/* Down */}
          <Button
            size="sm"
            onMouseDown={() => (heldDir.current = "down")}
            onTouchStart={() => (heldDir.current = "down")}
            onMouseUp={() => (heldDir.current = null)}
            onMouseLeave={() => (heldDir.current = null)}
            onTouchEnd={() => (heldDir.current = null)}
          >
          ↓
          </Button>
    </div>
      )}
    </div>
  );
}