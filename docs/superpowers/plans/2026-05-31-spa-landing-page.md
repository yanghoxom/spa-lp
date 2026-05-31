# Spa Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a static luxury spa landing page that filters Facebook visitors through a consultation quiz and sends qualified leads back to Phùng Hà KOREA.

**Architecture:** Vite serves a static TypeScript application. `src/quiz.ts` owns pure recommendation logic, `src/main.ts` owns DOM interaction, and `src/styles.css` owns the luxury spa visual system. GitHub Actions builds `dist` and deploys it to GitHub Pages.

**Tech Stack:** Vite, TypeScript, Vitest, GitHub Pages, GitHub Actions.

---

### Task 1: Project setup and tests

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tests/quiz.test.ts`
- Create: `.gitignore`

- [x] **Step 1: Write failing quiz tests**

Create `tests/quiz.test.ts` with assertions for melasma/oily recommendations, sensitive/acne recommendations, and Messenger text formatting.

- [x] **Step 2: Run test to verify it fails**

Run: `npm install && npm test`
Expected: FAIL because `src/quiz` is missing, then FAIL on assertions after adding a stub.

- [x] **Step 3: Implement quiz logic**

Create `src/quiz.ts` with typed answers, labels, result builder, deterministic code generation, and Messenger text.

- [x] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

### Task 2: Landing page UI

**Files:**
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `vite.config.ts`

- [x] **Step 1: Build semantic page shell**

Add hero, trust strip, quiz section, result section, service cards, editorial explanation, policy, FAQ, footer, and sticky CTA.

- [x] **Step 2: Wire interactive quiz**

Render five radio-question groups, update progress, generate result card, build Messenger URL, and support copy-to-clipboard.

- [x] **Step 3: Apply visual design**

Use ivory/champagne/rose/pine palette, editorial typography, glass cards, arch imagery, responsive layout, and mobile CTA.

### Task 3: Deployment

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`

- [x] **Step 1: Configure GitHub Pages build**

Use Actions checkout, setup-node, `npm ci`, `npm run build`, upload-pages-artifact, and deploy-pages.

- [x] **Step 2: Create GitHub repository**

Initialize git, create `spa-lp` through `gh repo create`, push `main`, and enable Pages through the workflow source.

- [x] **Step 3: Verify final build**

Run `npm test` and `npm run build`; ensure both pass before final handoff.
