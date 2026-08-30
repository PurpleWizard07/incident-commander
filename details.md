# WebMCP Challenge Hackathon

## What is WebMCP?

**WebMCP** is an emerging open standard that lets websites expose structured tools agents can use directly. Instead of leaving agents to guess their way through your UI, you define exactly how they can use your app, so they complete tasks **faster**, **more accurately**, and **more reliably**.

The **WebMCP Challenge** invites you to build something we haven’t seen before: an app that becomes meaningfully better when people and their agents can use it together.

---

## Getting Started

### 1. Learn
Read the **WebMCP specification** and **Chrome’s developer documentation** to understand how websites can expose tools to AI agents.

### 2. Get Inspired
- Explore the **WebMCP Showcase** for examples of agent-native apps and ideas for what you could build
- Read the **WebMCP guide from OpenAI**

### 3. Build & Deploy
Create a new WebMCP-enabled app or add WebMCP support to an existing one. Host it on:
- ChatGPT Sites
- Cloudflare
- Vercel
- Render
- Netlify
- Shopify
- Any deployment platform of your choice

### 4. Test Your App
- **ChatGPT**: Open your deployed app in ChatGPT’s in-app browser (supports WebMCP out of the box)
- **Google Chrome**: Enable WebMCP using `chrome://flags/#enable-webmcp-testing`

---

## Requirements

### What to Build

Build a **WebMCP-powered web app** that imagines and explores the future of the open web—where humans and agents can interact, collaborate, and create together.

### What to Submit

#### 1. **Live URL**
- Provide a working live URL that judges can access using ChatGPT’s in-app browser or Google Chrome with WebMCP enabled
- Host on: ChatGPT Sites, Cloudflare, Vercel, Render, Netlify, or any provider of your choice
- Authentication allowed (add credentials to submission form if needed)

#### 2. **Text Description**
Explain:
- Why your use case is a strong fit for WebMCP
- How it creates a better user experience
- What people and agents can do together that was difficult or impossible before
- How you implemented WebMCP

#### 3. **Demo Video**
- Public YouTube video (<3 minutes)
- Clear demo with audio
- Show what you built and how you used WebMCP

#### 4. **Public Code Repository**
Host on GitHub, GitLab, or Bitbucket with:
- All source code, assets, and instructions needed to run the project
- An open source license file (detectable and visible in the repository About section)
- WebMCP tools implemented in this format:

```javascript
document.modelContext.registerTool({
  name: "search_products",
  description: "Search the product catalog",
  inputSchema: { /* ... */ },
  execute: async (input) => { /* ... */ }
});
```



---

## Judging Criteria

| Criterion | Description |
|-----------|-------------|
| **WebMCP Leverage** | How thoroughly and skillfully does the project use WebMCP? Does the code reflect genuine effort and a working, non-trivial implementation? |
| **Execution** | Does the project deliver a working or runnable project that has a complete, coherent product experience — not just a technical proof of concept? |
| **Potential Impact** | Does the project make a credible, specific case for solving a real problem for a real audience — and does the solution actually address that problem based on what's demonstrated? |
| **Creativity & Ambition** | How creative and novel is the concept and does the project differ from existing concepts? |



---

## Resources

### Getting Started

Start with the documentation and supporter resources below, then test your deployed app:
- **ChatGPT**: Use ChatGPT’s in-app browser (WebMCP enabled out of the box)
- **Google Chrome**: Enable via `chrome://flags/#enable-webmcp-testing`

Use starter templates and example apps for inspiration.

---

### Core Documentation

- [**webmachinelearning/webmcp on GitHub**](https://github.com/webmachinelearning/webmcp) — Specification source, explainers, and open issues
- [**WebMCP Developer Documentation (Google Chrome)**](https://developer.chrome.com/docs/ai/webmcp) — Official documentation from Google

---

### Resources from Hackathon Supporters

#### 🔗 OpenAI

- [**WebMCP Showcase**](https://developers.openai.com/showcase?view=webmcp-apps) — Explore examples of agent-native apps
- [**ChatGPT Sites**](https://learn.chatgpt.com/docs/sites?surface=app) — Build and host a site in ChatGPT

#### ☁️ Cloudflare

- [**WebMCP Overview**](https://blog.cloudflare.com/webmcp/) — Introduction to WebMCP and its potential uses
- [**WebMCP on Browser Run**](https://developers.cloudflare.com/browser-run/features/webmcp/) — Documentation for working with WebMCP in Cloudflare Browser Run
- [**Coffee-store Demo**](https://webmcp-coffee.jilles.fyi/) — A WebMCP-enabled commerce example
- [**Cloudflare Challenge Landing Page**](https://webmcp-challenge.examples.workers.dev/) — Explore Cloudflare’s WebMCP Challenge resources and examples
- [**WebMCP on Workers Template**](https://github.com/cloudflare/agents/tree/main/examples/webmcp-react) — Start from Cloudflare’s WebMCP React template for Workers
- [**Cloudflare Pages / Workers**](https://developers.cloudflare.com/pages/) — Deploy your project on Cloudflare

#### ▲ Vercel

- [**WebMCP Implementation**](https://github.com/vercel/shop/pull/498) — See how WebMCP was added to an existing storefront

#### 🔵 Google Chrome

- [**useWebMCPTool React Hook**](https://www.npmjs.com/package/use-webmcp-tool) — Add WebMCP tools to a React app
- [**WebMCP Explainer**](https://github.com/webmachinelearning/webmcp/blob/main/README.md) — Understand the API design and specification
- [**WebMCP Evals**](https://developer.chrome.com/docs/ai/webmcp/evals) — Test your WebMCP tools before you ship
- [**Debug WebMCP Tools**](https://developer.chrome.com/docs/devtools/application/webmcp) — Inspect and debug registered tools in Chrome DevTools
- [**Modern Web Guidance**](https://github.com/GoogleChrome/modern-web-guidance) — Use the WebMCP skill when building with coding agents
- [**WebMCP Demos**](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/demos) — Explore example implementations for inspiration

#### 🔴 Netlify

- [**Netlify**](https://www.netlify.com/) — Create an account, publish your app, and get a live URL. Free to start
- **Participant Credits** — The first 1,000 eligible builders to complete this form receive **3,000 Netlify credits** each to build and run their app (available to new and existing Netlify users)
- [**Choose Your Path**](https://docs.netlify.com/start/choose-your-path/) — Follow Netlify’s getting-started guide
- [**WebMCP Starter**](https://webmcp-starter.netlify.app/) — Copy a prompt and use an agent to build and deploy a full site on Netlify with Agent Runners
 