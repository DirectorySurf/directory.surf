---
title: "Test Guide"
description: "Internal fixture exercising every guide block type — not meant for publication."
subtitle: "Exercises every block type — used to sanity-check the guide template."
blocks:
  - type: h2
    text: "A heading block"
  - type: p
    text: "A paragraph block with **bold text** and a [markdown link](https://example.com)."
  - type: directories
    slugs: ["altern"]
  - type: h2
    text: "A directories block with several entries"
  - type: p
    text: "This block references every remaining directory, across every category, to check the card grid."
  - type: directories
    slugs: ["g2", "capterra", "trustradius", "saashub", "theres-an-ai-for-that", "futurepedia", "toolify"]
  - type: h2
    text: "An unknown slug is silently skipped"
  - type: directories
    slugs: ["does-not-exist"]
---
