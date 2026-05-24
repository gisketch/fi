# Project Brief

## One-Line Intent

Sleek, iOS-native PWA personal assistant client for communicating with Hermes.dev agent inside a remote VPS.

## Project Kind

pwa for ios

## Stack

vite spa (React, TypeScript, TailwindCSS v4, Framer Motion)

## Users

- **Primary user**: arnelglennjimenez (the developer) wanting immediate terminal execution and system state management access on their VPS in a premium chatbot form factor.
- **Non-goals**: Multi-tenant billing, public registration, cross-platform Android native bindings.

## Problem

Managing a VPS agent via terminal or CLI on mobile is extremely cumbersome, lack-luster, and prone to input zoom bugs. There is no custom, touch-friendly, high-fidelity iOS interface that represents tool runs (collapsible activities) and system resources beautifully.

## First Useful Version

A fully working standalone iOS PWA with:
- Glassmorphism UI styling optimized for Safari standalone notch offsets and touch dynamics.
- Connection settings drawer.
- In-bubble tool activity feeds displaying live Hermes Web API events.
- Live DeepSeek currency tracking and Codex limit metrics widget.

## Acceptance Criteria

- User can:
  - Securely send prompts to the Hermes.dev VPS endpoint.
  - View real-time WebSocket token stream responses with REST/SSE fallback paths available in the service layer.
  - Expand/collapse individual tool activities to see duration and command inputs.
  - View resource balances and limits on the system status card.
- System must:
  - Configure Hermes endpoint and regular token through environment variables (`.env`), with the caveat that Vite client env values are browser-visible.
  - Keep admin-token writes behind a private proxy path; never ship `HERMES_WEB_ADMIN_TOKEN` to the browser.
  - Enforce viewport zoom prevention on input focus (`maximum-scale=1.0`).
- Project is not done until:
  - It builds clean on standard Bun environment.
  - Full Sonata harness validations pass.

## Constraints

- **Package manager**: bun
- **Performance**: Instant touch feedbacks, zero input lag, smooth bottom sheet physics.
- **Data**: Active Hermes session id is persisted in `localStorage`; chat/session state is held in React reducer state and rehydrated through Hermes session resume/history.
