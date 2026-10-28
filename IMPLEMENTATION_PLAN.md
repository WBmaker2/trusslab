# TrussLab — Implementation Plan

**Project name:** TrussLab
**Folder:** `/Volumes/ External Drive 256G/Dev2/opencode/trusslab`
**Type:** Static educational SPA/PWA
**Runtime AI:** None. No LLM/API calls after build. All structural analysis runs in the browser.
**Target learners:** Grades 9–11 (Korean 중3~고2)
**Subject:** Physics and engineering — static equilibrium, tension, compression, trusses
**MVP duration:** 3–4 weeks

---

## 0. One-page summary

TrussLab is a bridge-design studio built around a single question: **why does a triangle hold its shape while a rectangle collapses?**

Students place nodes and members on a grid, add pin and roller supports, and apply a load. The app solves the truss with the method of joints, colors every member by tension or compression, and reports the factor of safety. A load test animates the deflection and shows which member fails first. A 3D view extrudes the same solved truss into a bridge deck so students can connect the 2D diagram to a real structure.

The app is **not** an AI tutor and **not** an engineering certification tool. Every force comes from a deterministic linear solve. The structural model is 2D and idealized: pin joints, no bending moments, and a simplified buckling check. Those assumptions are visible in the UI.

**Why this is a strong build**

- Real, testable statics: equilibrium equations, reactions, member forces, determinacy, zero-force members, and buckling all have exact expected values.
- Strong visual payoff: stress colors, exaggerated deflection, failure animation, and a 3D bridge view.
- Clear misconceptions to target: "thicker is always stronger", "compression and tension are the same", "a rectangle is a stable shape", "a member with no force is useless but harmless".
- The hard part is the solver and the design constraints, not the art. That makes it a good fit for a coding model that can write matrix code and unit tests.

**MVP shape**

- 2D truss editor on a 1 m grid.
- Pin and roller supports, point loads, and two materials.
- Method-of-joints solver for statically determinate trusses.
- Tension/compression colors, utilization, factor of safety, and cost.
- Buckling check for compression members.
- Load test with exaggerated deflection and first-member failure.
- 3D bridge view of the same solved truss.
- Six missions, local progress, teacher mode, PWA.

---

## 1. Product definition

### 1.1 Learning problem

Students learn "triangles are strong" as a slogan but cannot explain why. They confuse tension and compression, cannot identify zero-force members, and do not connect a member's force to its shape, length, or material. A static diagram does not let them remove a member, change a support, or watch a structure fail.

### 1.2 Learning goals

By the end of the core missions, a student should be able to:

- Explain why a triangle is stable and a rectangle is not.
- Identify tension and compression members in a loaded truss.
- Apply joint equilibrium to a simple truss and solve for member forces.
- Distinguish statically determinate, indeterminate, and unstable trusses.
- Explain what a zero-force member is and why it can still be useful.
- Predict which member will fail first from its force and length.
- Use cost and factor of safety to compare two designs.
- Distinguish a 2D teaching model from a real bridge design.

### 1.3 Core learning loop

1. **Predict** — the mission asks which member is in tension, which design is stronger, or where the structure will fail.
2. **Build** — the student places nodes, members, supports, and loads.
3. **Test** — the solver colors the members and reports forces, utilization, and cost.
4. **Explain** — the student answers a short question using the force evidence.
5. **Connect** — a one-sentence takeaway links the truss to a real bridge or roof.

### 1.4 Success criteria

- A student can explain why a triangle is stable and a rectangle is not.
- A student can identify tension and compression in a simple loaded truss.
- A student can solve a three-member truss by hand and check it in the app.
- A student can find and remove a zero-force member.
- A student can design a truss that holds a target load within a budget.
- A student can explain why a long compression member fails before a short one.
- A teacher can reset progress, reveal answers, and print a worksheet without code changes.

---

## 2. Scope

### MVP (must ship)

- Grid-based 2D truss editor: nodes, members, pin supports, roller supports, point loads.
- Materials: wood and steel with different stiffness, strength, and cost.
- Statically determinate truss solver using the method of joints.
- Determinacy and stability checks with clear messages.
- Member force table with tension/compression signs.
- Stress/utilization color map and factor of safety.
- Zero-force member detection.
- Euler buckling check for compression members.
- Cost calculation and a budget constraint.
- Load test with exaggerated deflection and first-member failure.
- 3D bridge view of the solved truss with a deck and load arrow.
- Six missions with prediction gates and explanations.
- Local progress, teacher reset, printable worksheet.
- Responsive layout, keyboard alternative, reduced motion.
- PWA install and offline cache.

### Later (do not build in the first pass)

- Stiffness-matrix solver for indeterminate trusses.
- Full deflection analysis for all trusses.
- Progressive collapse with member removal and re-solve.
- Cable stays, arches, and suspension bridges.
- Dynamic loads, wind, and earthquakes.
- 3D trusses and space frames.
- Optimization solver for minimum cost.
- Real material databases and building codes.
- Classroom accounts or teacher dashboards.

### Out of scope

- Real engineering certification or safety-critical design.
- Building-code compliance.
- Welding, connection design, or fatigue.
- Any server, database, login, or analytics.
- Any runtime AI or generated explanations.
- Claims that a student design is safe for real construction.

---

## 3. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Build | Vite + TypeScript | Static output, fast iteration |
| 2D editor | Canvas 2D + DOM overlay | Precise grid editing and hit testing |
| 3D view | Three.js | Extruded bridge, stress colors, failure animation |
| Structural math | Pure TypeScript modules | Deterministic and unit-testable without a DOM |
| Math tests | Vitest | Equilibrium, determinacy, buckling, cost |
| Browser tests | Playwright | Editing, load tests, missions, accessibility |
| PWA | `vite-plugin-pwa` | Offline classroom use |
| Hosting | GitHub Pages / Cloudflare Pages | No server |

**Constraints**

- Node.js 20+.
- No backend, no API keys, no runtime network calls.
- No external textures or model files. Use procedural materials and system fonts.
- Target 60 fps on a mid-range laptop and ≥ 30 fps on a school tablet.
- Initial gzip bundle under 800 KB.
- All structural calculations must run without a DOM.

---

## 4. Architecture

### 4.1 Module map

```text
src/
  main.ts
  app/
    App.ts
    state.ts
    routes.ts
  struct/
    types.ts             nodes, members, supports, loads
    geometry.ts          member lengths and angles
    determinacy.ts       m + r vs 2j and rank checks
    methodOfJoints.ts    equilibrium matrix and solve
    forces.ts            member force results and signs
    buckling.ts          Euler buckling check
    failure.ts           utilization and first failure
    cost.ts              material and budget calculations
    materials.ts         wood, steel, and section properties
    units.ts             newtons, meters, pascals, cost
  editor/
    grid.ts
    placement.ts
    hitTest.ts
    commands.ts          undo/redo
  render/
    DesignCanvas.ts
    StressColors.ts
    BridgeScene.ts
    Deflection.ts
    FailureAnimation.ts
    CameraRig.ts
  features/
    test/
    missions/
    teacher/
  data/
    missions.json
    materials.json
  ui/
    components/
    styles/
  storage/
    progress.ts
  tests/
    unit/
    e2e/
```

### 4.2 Coordinate frames and units

- Design coordinates are in meters, with `x` to the right and `y` up.
- The grid is 1 m; the canvas shows 12 m × 8 m in the default view.
- Forces are in newtons; stress in pascals; cost in abstract "credits" or a currency label.
- The 3D view maps 1 m to 1 scene unit; the bridge depth is 0.4 m and the deck width is 2 m.
- Deflection is exaggerated by a fixed factor (e.g., 20×) and labeled.
- Never mix canvas pixels into the structural math.

### 4.3 State

```ts
interface AppState {
  route: 'design' | 'test' | 'missions' | 'teacher';
  model: {
    nodes: TrussNode[];
    members: TrussMember[];
    loads: PointLoad[];
    nextNodeId: number;
    nextMemberId: number;
  };
  selection: {
    kind: 'node' | 'member' | null;
    id: number | null;
  };
  tool: 'select' | 'node' | 'member' | 'pin' | 'roller' | 'load' | 'delete';
  result: TrussResult | null;
  view: '2d' | '3d';
  overlays: {
    grid: boolean;
    labels: boolean;
    forces: boolean;
    stress: boolean;
    deflection: boolean;
  };
  mission: {
    currentId: string | null;
    prediction: string | null;
    completed: string[];
  };
  preferences: {
    reducedMotion: boolean;
    units: 'metric';
  };
}
```

### 4.4 Persistence

- `localStorage` key: `trusslab.progress.v1`.
- Store completed missions, answers, last model, and view preferences.
- Teacher reset clears progress after confirmation.
- No personal data.

---

## 5. Data model

### 5.1 Nodes, members, supports, loads

```ts
interface TrussNode {
  id: number;
  x: number;          // meters
  y: number;          // meters
  support: 'free' | 'pin' | 'roller';
}

interface TrussMember {
  id: number;
  a: number;          // node id
  b: number;          // node id
  materialId: 'wood' | 'steel';
}

interface PointLoad {
  id: number;
  nodeId: number;
  fx: number;         // newtons, positive right
  fy: number;         // newtons, positive up
}

interface TrussModel {
  nodes: TrussNode[];
  members: TrussMember[];
  loads: PointLoad[];
}
```

### 5.2 Materials and sections

```ts
interface Material {
  id: 'wood' | 'steel';
  nameKo: string;
  E: number;              // Pa
  allowableTension: number;   // Pa
  allowableCompression: number; // Pa
  costPerMeter: number;
  color: string;
  density: number;        // kg/m³
}
```

Initial values (tuned for a school-scale model):

| Material | E (GPa) | Allowable tension (MPa) | Allowable compression (MPa) | Cost/m |
|---|---:|---:|---:|---:|
| Wood | 10 | 30 | 20 | 20 |
| Steel | 200 | 250 | 200 | 80 |

- All members use a fixed square section: area `A = 5 × 10⁻⁴ m²`, moment of inertia `I = 2.08 × 10⁻⁸ m⁴`.
- The small section makes buckling visible at school-scale loads.
- Loads range from 100 N to 5,000 N; spans from 1 m to 12 m.
- These values are a teaching model, not a real design code.

### 5.3 Result

```ts
interface MemberResult {
  memberId: number;
  force: number;          // newtons, + tension, - compression
  stress: number;         // Pa, + tension, - compression
  utilization: number;    // |stress| / allowable, 0..∞
  bucklingLoad?: number;  // N, compression only
  state: 'ok' | 'warning' | 'failed';
  zeroForce: boolean;
}

interface TrussResult {
  reactions: { nodeId: number; fx: number; fy: number }[];
  members: MemberResult[];
  maxUtilization: number;
  factorOfSafety: number;
  cost: number;
  stable: boolean;
  determinate: boolean;
  deflection?: { nodeId: number; dx: number; dy: number }[];
  warnings: StructWarning[];
}
```

### 5.4 Mission

```ts
interface Mission {
  id: string;
  titleKo: string;
  concept: 'stability' | 'forces' | 'design' | 'budget' | 'buckling' | 'repair';
  promptKo: string;
  setup: {
    presetModel?: string;
    targetLoadN?: number;
    maxCost?: number;
    maxMembers?: number;
  };
  options: string[];
  answer: string;
  explanationKo: string;
  takeawayKo: string;
  difficulty: 1 | 2 | 3;
}
```

### 5.5 Constants

```ts
const GRID_METERS = 1;
const MIN_NODE_DISTANCE = 0.5;
const MAX_NODES = 30;
const MAX_MEMBERS = 60;
const MAX_SPAN_METERS = 12;
const MAX_HEIGHT_METERS = 8;
const FORCE_TOLERANCE = 0.5;        // N
const UTILIZATION_WARNING = 0.8;
const DEFLECTION_EXAGGERATION = 20;
const BUCKLING_K = 1.0;             // pinned-pinned
```

Keep these in one file with comments. Do not scatter magic numbers.

---

### 5.6 Mission content

The six missions are stored in `missions.json`. Each has a prediction gate and an explanation gate, and each loads a preset model or a design constraint.

1. `triangle-vs-square` — **삼각형은 왜 단단할까?**: build a triangle and a rectangle, load both, and compare the determinacy and deflection. Explain why the rectangle collapses.
2. `tension-compression` — **인장과 압축**: load a simple truss and predict which members are in tension and which are in compression. Check the signs in the force table.
3. `six-members` — **6개 부재로 버티기**: hold a 500 N load with at most six members. Use the utilization colors to find the weak member.
4. `budget` — **예산 안에서 설계**: hold an 800 N load under a fixed budget. Balance member count, material, and factor of safety.
5. `zero-force` — **힘이 0인 부재**: find a zero-force member in a preset truss. Decide whether removing it is safe, considering stability and buckling length.
6. `repair` — **불안정 구조 고치기**: a preset truss is a mechanism. Add one member to make it stable, then explain the determinacy change.

---

## 6. Core algorithms

### 6.1 Geometry

For each member between nodes `a` and `b`:

```text
dx = xb - xa
dy = yb - ya
L = sqrt(dx² + dy²)
cosθ = dx / L
sinθ = dy / L
```

Reject zero-length members and duplicate members. Snap nodes to the grid; merge nodes closer than `MIN_NODE_DISTANCE`.

### 6.2 Determinacy and stability

Let:

- `m` = number of members
- `j` = number of joints (nodes)
- `r` = number of reaction components: pin = 2, roller = 1

Then:

```text
m + r < 2j  → unstable (mechanism)
m + r = 2j  → statically determinate (if the equilibrium matrix is full rank)
m + r > 2j  → statically indeterminate
```

The MVP solves determinate trusses. For indeterminate trusses, show "부정정 구조는 아직 지원하지 않습니다" and suggest removing a member. For `m + r = 2j`, still check the rank of the equilibrium matrix; a full-rank square matrix means a stable determinate truss.

Also check:

- At least one support.
- At least one load.
- No node with a load but no member.
- No member crossing another member without a shared node (the editor warns).

### 6.3 Method of joints

Unknown vector:

```text
x = [F_1 ... F_m, R_1 ... R_r]ᵀ
```

Tension is positive. A tension member pulls its joint toward the other end. For each node `i`, sum the forces:

```text
ΣFx: Σ_m F_m × cosθ_mi + Σ_r R_r × rx_r + loadFx_i = 0
ΣFy: Σ_m F_m × sinθ_mi + Σ_r R_r × ry_r + loadFy_i = 0
```

Move the external loads to the right-hand side:

```text
A x = b,  b_i = -load_i
```

Assemble a `2j × (m + r)` matrix. For a determinate truss, it is square. Solve with Gaussian elimination with partial pivoting. If a pivot is near zero, the truss is a mechanism or the supports are insufficient; return a warning instead of NaNs.

**Sign convention:** positive force = tension (member pulls the joint inward). Negative force = compression.

**Worked example (test case):**

- Nodes: A(0,0) pin, B(4,0) roller, C(2,3) free.
- Members: AC, BC, AB.
- Load: C gets (0, −500 N).
- Reactions: Ay = 250 N, By = 250 N, Ax = 0.
- Member forces: AC = −300.5 N, BC = −300.5 N, AB = +166.7 N.
- Signs: AC and BC are compression; AB is tension.

This example must be a unit test with a tolerance of 0.5 N.

### 6.4 Member stress and utilization

```text
stress = F / A
allowable = stress >= 0 ? allowableTension : allowableCompression
utilization = |stress| / allowable
```

- `utilization < 0.8` → safe (green).
- `0.8 ≤ utilization ≤ 1.0` → warning (amber).
- `utilization > 1.0` → failed (red).
- Factor of safety = `1 / maxUtilization` when `maxUtilization > 0`.

Color must not be the only cue; show the numeric utilization and a T/C label.

### 6.5 Zero-force members

A member is a zero-force candidate when `|F| < FORCE_TOLERANCE`. Detect two common cases directly:

- Two non-collinear members at an unloaded joint with no support → both are zero-force.
- Three members at an unloaded joint where two are collinear → the third is zero-force.

The solver result is the source of truth; the rules are used for hints and mission feedback. A zero-force member can still be structurally necessary for stability or to reduce buckling length, so do not tell students to delete every zero-force member.

### 6.6 Buckling

For compression members (`F < 0`):

```text
P_cr = π² × E × I / (K × L)²
bucklingUtilization = |F| / P_cr
```

- `K = 1.0` for pinned-pinned members in the MVP.
- If `bucklingUtilization > 1`, the member buckles even if its stress is below the allowable compression.
- Effective utilization = `max(stressUtilization, bucklingUtilization)`.
- Show both values in the inspector so students can see why a long, slender member fails.

**Honesty:** real buckling depends on end conditions, imperfections, and connection details. The MVP uses a single ideal case.

### 6.7 Failure and load test

- Apply the load in 10 steps from 0 to the target.
- Compute utilization at each step.
- The first member to exceed 1.0 is the failure point.
- For the MVP, stop at the first failure and show a collapse animation.
- For a later phase, remove the failed member and re-solve to show progressive collapse.
- If the structure becomes unstable before the target load, report "구조가 불안정합니다" and highlight the mechanism.

### 6.8 Cost

```text
memberCost = length × costPerMeter
nodeCost = 5 credits per node
totalCost = Σ memberCost + Σ nodeCost
```

- Show the cost per member and the total.
- Missions can set a maximum cost and a target load.
- The score is pass/fail plus a "strength per cost" summary; do not rank students publicly.

### 6.9 Deflection (stretch)

The method of joints gives forces but not displacements. For the MVP, two options:

1. Use a simplified visual deflection based on member forces and lengths: `δ ∝ F L / (A E)`, applied along the member direction, then animate the shape.
2. Implement the stiffness method in a later milestone for accurate nodal displacements.

The MVP uses option 1 and labels the deflection "개념적 변형(과장)" so it is not mistaken for an exact displacement. The stiffness method is a later extension.

### 6.10 3D bridge view

- Extrude the 2D truss into a bridge deck:
  - The truss plane is at the side of the deck.
  - The deck is a thin box spanning the support nodes.
  - The load arrow points down at the loaded node.
- Apply the same member colors and utilization to the 3D members.
- The 3D view is a visualization of the 2D solve, not a separate 3D structural model. Label it "2D 해석을 3D로 표현".
- Animate the deflection by moving the 3D nodes along the exaggerated 2D displacement.
- Failure animation: the failed member turns red, shakes, and drops; the rest of the structure remains visible.

### 6.11 Determinism and units

- No randomness in the solver.
- Node and member ids are integers, stable across edits.
- The same model produces the same forces within 1e-6 N.
- Tests use hand-calculated values, not snapshots of floating-point noise.
- Format forces with 1 decimal place, stress with 2 significant digits, cost as an integer.

---

## 7. Screens and UX

### 7.1 Design screen

- **Center:** 2D canvas with grid, nodes, members, supports, and loads.
- **Left:** tool palette (select, node, member, pin, roller, load, delete) and material picker.
- **Right:** inspector for the selected node/member, plus the force table.
- **Bottom:** cost, member count, determinacy status, and a "test" button.
- **Top:** undo/redo, reset, 2D/3D toggle, help.

### 7.2 Test screen

- Load test progress and a "run test" button.
- Member force table sorted by utilization.
- Max utilization, factor of safety, and cost.
- Failure card with the first failed member and the reason (stress or buckling).
- A "back to design" button that preserves the model.

### 7.3 3D bridge view

- Orbitable bridge with a deck, truss, supports, and load arrow.
- Stress colors and utilization labels.
- Deflection exaggeration toggle.
- A "2D 해석을 3D로 표현" badge.

### 7.4 Mission screen

- Prediction card with a question and 3–4 options.
- The design canvas is loaded with the mission preset.
- The student edits, tests, and answers the explanation question.
- On success: explanation, takeaway, and a "next mission" button.
- On failure: a hint that points to the force table or the determinacy status, not the answer.

### 7.5 Teacher mode

- Mission list with concepts, answers, and explanations.
- Preset models for a triangle, a rectangle, a Warren truss, and a failed design.
- Reset progress.
- Print a worksheet with a blank grid and a force table.
- Toggle answer visibility for classroom projection.

### 7.6 Responsive layout

**Desktop (≥ 1024 px)**

- Three columns: tools, canvas, inspector.

**Tablet (768–1023 px)**

- Canvas with collapsible drawers.

**Phone (< 768 px)**

- Canvas at the top; bottom sheet tabs: Build | Forces | Mission.
- Large touch targets and a simplified member tool.
- Pinch to zoom; two-finger pan.

### 7.7 Accessibility

- Keyboard: `Tab` through tools, arrow keys move the cursor, `Enter` to place a node, `M` to start a member, `Enter` to connect, `Delete` to remove.
- Every model state has a text summary: nodes, members, supports, loads, determinacy, max utilization.
- The force table is a real HTML table with sortable headers.
- Respect `prefers-reduced-motion`: skip the collapse animation and show a static failed state.
- Do not encode tension/compression by color alone; use `T`/`C` labels and numeric values.
- Provide a "read the truss" panel that lists members and forces in words.
- Ensure warnings are announced with `aria-live="polite"`.

---

## 8. Implementation milestones

### M0 — Setup (0.5 day)

- Scaffold Vite + TypeScript + Three.js.
- Add Vitest, Playwright, ESLint, Prettier, PWA plugin.
- Create the module map and a blank canvas.
- **Verify:** dev server, build, and tests run.

### M1 — Structural core (3–4 days)

- Implement geometry, determinacy, the method-of-joints matrix, and the linear solver.
- Write unit tests for the worked triangle and a second truss.
- Implement zero-force detection and warnings.
- **Verify:** all solver tests pass without a DOM.

### M2 — 2D editor (3–4 days)

- Implement the grid, node/member placement, supports, loads, hit testing, and undo/redo.
- Build the inspector and force table.
- **Verify:** a student can build the worked triangle and get the expected forces.

### M3 — Stress, buckling, and cost (2–3 days)

- Implement stress, utilization, buckling, materials, and cost.
- Add the color map and the numeric labels.
- **Verify:** long compression members fail by buckling before stress.

### M4 — Load test and 3D view (3 days)

- Implement the load ramp, first failure, and collapse animation.
- Build the 3D bridge view and deflection exaggeration.
- **Verify:** the 3D colors and deformation match the 2D result.

### M5 — Missions and teacher mode (2–3 days)

- Author six missions with prediction and explanation gates.
- Add progress persistence, teacher reset, and the printable worksheet.
- **Verify:** each mission can be completed from a fresh state.

### M6 — Responsive, accessibility, PWA (2 days)

- Implement the layouts.
- Add keyboard controls, text summaries, reduced motion.
- Configure offline caching.
- **Verify:** keyboard-only completion; offline reload.

### M7 — QA and pilot (2 days)

- Run all tests and screenshot checks.
- Test on a low-end tablet.
- Ask 3–5 students to try the triangle, tension/compression, and budget missions.
- Fix the top usability issues.
- Deploy.
- **Verify:** acceptance criteria below are met.

---

## 9. Testing and verification

### Unit tests (Vitest)

- Member length and angle for known coordinates.
- Determinacy: `m + r` cases for stable, unstable, and indeterminate trusses.
- Worked triangle: reactions 250 N, 250 N, 0; AC/BC −300.5 N; AB +166.7 N.
- A second hand-calculated truss (e.g., a Warren truss) with known forces.
- Sign convention: tension positive, compression negative.
- Zero-force member rules for the two classic cases.
- Buckling load for a known member length and material.
- Buckling utilization > 1 for a long compression member.
- Stress utilization and factor of safety.
- Cost calculation and budget check.
- Singular matrix → warning, not NaN.
- Determinism: repeated solves return identical forces within 1e-6 N.

### Interaction tests (Playwright)

- Place nodes, members, supports, and a load; run the test.
- Delete a member and confirm the truss becomes unstable.
- Add a diagonal to a rectangle and confirm it becomes stable.
- Switch materials and confirm the utilization changes.
- Run the load test and confirm the first failure.
- Toggle 2D/3D and confirm the colors match.
- Complete a mission correctly and incorrectly.
- Reset progress in teacher mode.
- Keyboard-only path through the triangle mission.

### Visual tests

- Screenshot a triangle, a rectangle, a Warren truss, and a failed truss.
- Screenshot the force table and the 3D bridge.
- Run at 1440×900, 1024×768, and 390×844.
- Check that the "2D model, exaggerated deflection" badges are visible.

### Accessibility checks

- `axe-core` scan with no critical issues.
- Keyboard reaches every control.
- Reduced motion skips the collapse animation.
- Text summary matches the current model.
- Tension/compression is not conveyed by color alone.
- The force table is screen-reader friendly.

### Performance budget

- 60 fps on a mid-range laptop; ≥ 30 fps on a school tablet.
- Solve time < 5 ms for 60 members.
- No per-frame object creation.
- Pause rendering when the tab is hidden.
- DPR clamp to 2.
- Initial load < 2.5 s on simulated 4G.

---

## 10. Acceptance criteria / Go-No-Go

- [ ] A student can build the worked triangle and get the expected forces.
- [ ] Tension and compression are labeled and colored correctly.
- [ ] A rectangle without a diagonal is flagged as unstable.
- [ ] A diagonal makes the rectangle stable.
- [ ] The determinacy status is correct for determinate, indeterminate, and unstable trusses.
- [ ] Zero-force members are detected and explained.
- [ ] A long compression member fails by buckling before stress.
- [ ] The load test identifies the first failed member.
- [ ] Cost and factor of safety are reported.
- [ ] The 3D bridge view matches the 2D solve.
- [ ] Six missions are playable, scored, and saved locally.
- [ ] Teacher reset works.
- [ ] Keyboard-only mission completion works.
- [ ] Reduced motion is respected.
- [ ] The app works offline after the first load.
- [ ] No runtime network calls to an AI service or backend.
- [ ] The "2D idealized model, not for real construction" notice is visible.

If the worked triangle or determinacy tests fail, stop and fix the solver before adding missions.

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sign convention is reversed | Tension and compression are swapped | Worked-example unit test; explicit sign convention in the inspector |
| Singular matrix produces NaNs | Broken UI | Rank check, pivot threshold, user-facing "unstable" warning |
| Determinate-only solver is mistaken for a general solver | Overclaim | Visible "determinate only" notice; indeterminate is a later phase |
| Buckling model is oversimplified | False confidence | Label it an ideal Euler case; show both stress and buckling utilization |
| 2D solve and 3D view diverge | Confusing feedback | 3D reads only the 2D result; no separate physics |
| Students think a zero-force member is useless | Misconception | Explain stability and buckling-length roles; mission on when to keep one |
| Design tool is mistaken for a real engineering tool | Safety concern | Persistent "not for real construction" notice; no building-code claims |
| Canvas editing is inaccessible | Some students cannot build | Full keyboard path and a DOM-based force table |
| Cost model rewards fragile designs | Wrong incentive | Show factor of safety and utilization alongside cost; pass/fail gate |

---

## 12. AI build guide

Use the AI coding agent for scaffolding, the solver, the editor, tests, and screenshot-driven fixes. Statics sign conventions are easy to get subtly wrong, so tests and teacher review are mandatory.

### Recommended build order

1. Scaffold Vite + TypeScript + Three.js with tests.
2. Implement the pure geometry, determinacy, and method-of-joints modules and unit tests.
3. Build the 2D editor without stress colors.
4. Add the force table and inspector.
5. Add stress, buckling, and cost.
6. Add the load test and failure animation.
7. Add the 3D bridge view.
8. Add missions and teacher mode.
9. Do responsive/accessibility passes.
10. Use screenshots at three viewports and fix visual regressions.

### Prompt rules

- State the constraint: “No backend, no runtime AI, no network calls.”
- Require a test for every solver rule and sign convention.
- Ask the agent to write the equilibrium equations and sign convention in comments before coding.
- Use hand-calculated values in tests, not snapshots of floating-point noise.
- Never let the app claim to certify a design for real construction.
- Provide screenshots when fixing editor or 3D issues.

### What not to delegate

- The decision that the idealized 2D model is pedagogically acceptable.
- The final review of the worked example and failure behavior.
- Accessibility judgment.
- Classroom pilot feedback.

### Definition of done

- All solver and interaction tests pass.
- The acceptance checklist is complete.
- A teacher can run the six missions without developer help.
- The model's simplifications are visible in the UI.

---

## 13. Future extensions

- Stiffness-matrix solver for indeterminate trusses.
- Accurate nodal deflection for all trusses.
- Progressive collapse with member removal and re-solve.
- Cable stays, arches, and suspension bridges.
- Dynamic loads, wind, and earthquakes.
- 3D trusses and space frames.
- Minimum-cost optimization.
- Real material databases and building-code references as an optional, labeled mode.
- Classroom worksheet generator.
- Localization.

---

## 14. References

- MIT OpenCourseWare — Structural analysis: https://ocw.mit.edu/
- Engineering LibreTexts — Trusses: https://eng.libretexts.org/
- Hibbeler, Structural Analysis (reference textbook)
- Three.js documentation: https://threejs.org/docs/
- MDN Web APIs: https://developer.mozilla.org/en-US/docs/Web/API
- WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/

---

**Plan version:** 1.0
**Created:** 2026-10-28
**Next step:** scaffold the project, then implement M1 (geometry + determinacy + method of joints + tests) before building the editor.
