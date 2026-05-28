{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # CLAUDE.md\
\
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.\
\
**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.\
\
## 1. Think Before Coding\
\
**Don't assume. Don't hide confusion. Surface tradeoffs.**\
\
Before implementing:\
- State your assumptions explicitly. If uncertain, ask.\
- If multiple interpretations exist, present them - don't pick silently.\
- If a simpler approach exists, say so. Push back when warranted.\
- If something is unclear, stop. Name what's confusing. Ask.\
\
## 2. Simplicity First\
\
**Minimum code that solves the problem. Nothing speculative.**\
\
- No features beyond what was asked.\
- No abstractions for single-use code.\
- No "flexibility" or "configurability" that wasn't requested.\
- No error handling for impossible scenarios.\
- If you write 200 lines and it could be 50, rewrite it.\
\
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.\
\
## 3. Surgical Changes\
\
**Touch only what you must. Clean up only your own mess.**\
\
When editing existing code:\
- Don't "improve" adjacent code, comments, or formatting.\
- Don't refactor things that aren't broken.\
- Match existing style, even if you'd do it differently.\
- If you notice unrelated dead code, mention it - don't delete it.\
\
When your changes create orphans:\
- Remove imports/variables/functions that YOUR changes made unused.\
- Don't remove pre-existing dead code unless asked.\
\
The test: Every changed line should trace directly to the user's request.\
\
## 4. Goal-Driven Execution\
\
**Define success criteria. Loop until verified.**\
\
Transform tasks into verifiable goals:\
- "Add validation" \uc0\u8594  "Write tests for invalid inputs, then make them pass"\
- "Fix the bug" \uc0\u8594  "Write a test that reproduces it, then make it pass"\
- "Refactor X" \uc0\u8594  "Ensure tests pass before and after"\
\
For multi-step tasks, state a brief plan:\
```\
1. [Step] \uc0\u8594  verify: [check]\
2. [Step] \uc0\u8594  verify: [check]\
3. [Step] \uc0\u8594  verify: [check]\
```\
\
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.\
\
---\
\
**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.}