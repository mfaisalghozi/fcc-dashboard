<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const modules = [
  {
    route: null,
    label: 'Investigation & Analysis UTR',
    sublabel: 'UTR Investigation',
    description: 'Automated parsing and AI-assisted analysis of Unusual Transaction Reports.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>`,
    tag: 'Automated',
  },
  {
    route: '/logbook',
    label: 'Logbook & Approval',
    sublabel: 'Case Registry',
    description: 'Track batch submissions, review decisions, and manage STR approval workflow.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 9h6M9 13h4"/></svg>`,
    tag: 'Compliance',
  },
  {
    route: null,
    label: 'Drafting & Report',
    sublabel: 'STR Generation',
    description: 'Compose, review, and export Suspicious Transaction Reports for submission.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    tag: 'Reporting',
  },
]
</script>

<template>
  <div class="page">
    <div class="noise" />

    <header class="header">
      <div class="header-inner">
        <div class="wordmark">
          <span class="wordmark-fcc">FCC</span>
          <span class="wordmark-sep">|</span>
          <span class="wordmark-sub">Dashboard</span>
        </div>
        <p class="tagline">Financial Crime Compliance · Zone 2 Operations</p>
      </div>
      <div class="header-rule" />
    </header>

    <main class="main">
      <div class="eyebrow">Select a module to continue</div>

      <div class="cards">
        <button
          v-for="mod in modules"
          :key="mod.route"
          class="card"
          :class="{ 'card--disabled': !mod.route }"
          @click="mod.route && router.push(mod.route)"
        >
          <div class="card-tag">{{ mod.tag }}</div>
          <div class="card-icon" v-html="mod.icon" />
          <div class="card-body">
            <h2 class="card-label">{{ mod.label }}</h2>
            <p class="card-sublabel">{{ mod.sublabel }}</p>
            <p class="card-desc">{{ mod.description }}</p>
          </div>
          <div class="card-arrow">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </button>
      </div>
    </main>

    <footer class="footer">
      <span>LTKM Zone 2 · Internal Use Only</span>
      <span class="footer-dot">·</span>
      <span>{{ new Date().getFullYear() }}</span>
    </footer>
  </div>
</template>

<style scoped>
/* ── Variables ──────────────────────────────────── */
:root {
  --bg: #f7f6f3;
  --ink: #2c2c2a;
  --ink-faint: #8a8880;
  --blue: #185fa5;
  --blue-light: #e8f0fa;
  --rule: #dddbd6;
  --card-bg: #ffffff;
  --card-shadow: 0 1px 3px rgba(44,44,42,.07), 0 4px 16px rgba(44,44,42,.06);
  --card-shadow-hover: 0 4px 8px rgba(44,44,42,.1), 0 16px 40px rgba(44,44,42,.12);
  --radius: 14px;
}

/* ── Reset / base ───────────────────────────────── */
* { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Page shell ─────────────────────────────────── */
.page {
  min-height: 100vh;
  background: #f7f6f3;
  color: #2c2c2a;
  font-family: 'Georgia', 'Times New Roman', serif;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-x: hidden;
}

/* subtle grain overlay */
.noise {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: .025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}

/* ── Header ─────────────────────────────────────── */
.header {
  position: relative;
  z-index: 1;
  padding: 48px 60px 0;
}

.header-inner {
  display: flex;
  align-items: baseline;
  gap: 24px;
  flex-wrap: wrap;
}

.wordmark {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
  font-family: 'Courier New', monospace;
  font-weight: 700;
  letter-spacing: .18em;
  text-transform: uppercase;
}

.wordmark-fcc {
  color: #185fa5;
  font-size: 15px;
  letter-spacing: .22em;
}

.wordmark-sep {
  color: #dddbd6;
  font-weight: 300;
}

.wordmark-sub {
  color: #2c2c2a;
}

.tagline {
  font-family: 'Georgia', serif;
  font-size: 13px;
  color: #8a8880;
  font-style: italic;
  letter-spacing: .02em;
}

.header-rule {
  margin-top: 24px;
  height: 1px;
  background: linear-gradient(to right, #185fa5 60px, #dddbd6 60px);
}

/* ── Main ───────────────────────────────────────── */
.main {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 40px;
  gap: 32px;
}

.eyebrow {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: #8a8880;
}

/* ── Cards ──────────────────────────────────────── */
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 960px;
  width: 100%;
}

.card {
  position: relative;
  background: #ffffff;
  border: 1px solid #dddbd6;
  border-radius: 14px;
  padding: 32px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  cursor: pointer;
  text-align: left;
  color: #2c2c2a;
  box-shadow: 0 1px 3px rgba(44,44,42,.07), 0 4px 16px rgba(44,44,42,.06);
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: #185fa5;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 280ms cubic-bezier(.22,.68,0,1.2);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 8px rgba(44,44,42,.1), 0 16px 40px rgba(44,44,42,.12);
  border-color: #c8c5be;
}

.card:hover::before {
  transform: scaleX(1);
}

.card:focus-visible {
  outline: 2px solid #185fa5;
  outline-offset: 3px;
}

/* tag */
.card-tag {
  display: inline-block;
  align-self: flex-start;
  font-family: 'Courier New', monospace;
  font-size: 9px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: #185fa5;
  background: #e8f0fa;
  padding: 3px 8px;
  border-radius: 4px;
}

/* icon */
.card-icon {
  width: 40px;
  height: 40px;
  color: #185fa5;
}

.card-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

/* text */
.card-label {
  font-family: 'Georgia', serif;
  font-size: 17px;
  font-weight: normal;
  line-height: 1.2;
  color: #2c2c2a;
}

.card-sublabel {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #8a8880;
  margin-top: 2px;
}

.card-desc {
  font-family: 'Georgia', serif;
  font-size: 13px;
  color: #6b6a67;
  line-height: 1.6;
  font-style: italic;
}

/* arrow */
.card-arrow {
  margin-top: auto;
  width: 20px;
  height: 20px;
  color: #c8c5be;
  align-self: flex-end;
  transition: transform 220ms ease, color 220ms ease;
}

.card:hover .card-arrow {
  transform: translateX(4px);
  color: #185fa5;
}

.card-arrow svg {
  width: 100%;
  height: 100%;
}

.card--disabled .card-arrow {
  opacity: 0;
}

/* ── Footer ─────────────────────────────────────── */
.footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  font-family: 'Courier New', monospace;
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #c8c5be;
}

.footer-dot { color: #dddbd6; }

/* ── Responsive ─────────────────────────────────── */
@media (max-width: 768px) {
  .header { padding: 32px 24px 0; }
  .cards { grid-template-columns: 1fr; max-width: 400px; }
  .main { padding: 48px 24px; }
}

@media (max-width: 480px) {
  .header-inner { flex-direction: column; gap: 6px; }
  .cards { gap: 14px; }
}
</style>
