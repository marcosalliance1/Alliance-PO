{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # Using this repo with Cursor\
\
This project includes a **Cursor project rule** so the Karpathy-inspired behavioral guidelines apply automatically when you work here.\
\
## In this repository\
\
1. Open the folder in Cursor.\
2. The rule [`.cursor/rules/karpathy-guidelines.mdc`](.cursor/rules/karpathy-guidelines.mdc) is committed with `alwaysApply: true`, so you do not need extra installation steps.\
3. In Cursor, you can confirm it under **Settings \uc0\u8594  Rules** (or the project rules UI), where `karpathy-guidelines` should appear.\
\
## Use the same guidelines in another project\
\
**Cursor (recommended):** Copy `.cursor/rules/karpathy-guidelines.mdc` into that project\'92s `.cursor/rules/` directory (create the folders if needed). Adjust or merge with existing rules as you like.\
\
**Other tools:** If a stack only supports a root instruction file, copy [`CLAUDE.md`](CLAUDE.md) into that project instead (or merge its contents into your existing instructions).\
\
## Optional: personal Agent Skills\
\
If you want the same content as a reusable skill under `~/.cursor/skills`, use [`skills/karpathy-guidelines/SKILL.md`](skills/karpathy-guidelines/SKILL.md). You can copy or symlink it into your personal skills directory; use whatever layout you use for other skills.\
\
## Claude Code vs Cursor\
\
- **Claude Code:** Install via the plugin marketplace and [`README.md`](README.md) instructions; the plugin exposes the skill from this repo. Per-project use can also rely on `CLAUDE.md`.\
- **Cursor:** Use the committed `.cursor/rules/` file as described above. Cursor does not read `.claude-plugin/` or `CLAUDE.md` by default.\
\
## For contributors\
\
When you change the four principles, keep **[`CLAUDE.md`](CLAUDE.md)** and **[`.cursor/rules/karpathy-guidelines.mdc`](.cursor/rules/karpathy-guidelines.mdc)** in sync. If the published skill/plugin text should match, update **[`skills/karpathy-guidelines/SKILL.md`](skills/karpathy-guidelines/SKILL.md)** as well.}