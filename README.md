# skill-router

A Claude Code mod that suggests the right skills for each prompt. On every
prompt it asks [Jev](https://typesafe.ai) whether each skill fits, shows the
ones over the threshold ranked above the prompt, and passes them to the model as
a suggestion. It never orders a skill loaded: the model decides.

```
Jev suggests · tdd 0.96 · animate 0.95 (240 ms)
```

## How it works

- Candidates are the skills the model can invoke itself (the engine's own
  listing), minus any the main conversation already loaded. User-only slash
  commands are left out.
- One Noul question per skill, all in one request: "is the user asking for this
  kind of task to be done now?" Each skill gets its own probability, so none at
  all is a normal outcome, and a prompt that only asks about or weighs a task
  does not trigger it.
- Skills at or over the threshold are ranked, up to the maximum, and passed to
  the model as a hidden note: a suggestion to load one only if it clearly helps,
  and never one that runs actions or delegates work unless you asked.
- Why only suggest: a mod cannot tell a skill that only teaches from one that
  acts (delegates to another agent, runs a subagent), and every loaded skill
  costs context.
- Skills the main conversation loads are remembered and not suggested again;
  a subagent's loads do not count, and `/clear` forgets them.
- Fails open: a timeout, an outage or a missing key only skips the routing, and
  the band says why. The band clears when a prompt is not routed.
- Skips slash commands, prompts under 12 characters, and prompts not typed by you.

## Options

Set in `/plugin` → Installed → skill-router → Configure options.

| Option | Default | Meaning |
| --- | --- | --- |
| Threshold | 0.8 | Probability (above 0, up to 1) a skill needs to be suggested; anything else falls back to 0.8 |
| Max suggestions | 3 | Skills over the threshold to show and suggest, highest first |
| Timeout (ms) | 1500 | How long to wait for Jev before sending the prompt without skills |

## Install

Needs the [`jev`](https://github.com/gecm0/jev-mod) mod and a TypeSafe key.

```
/plugin install jev --marketplace gecm0/jev-mod
/plugin install skill-router --marketplace gecm0/skill-router-mod
```

## Data and cost

Every routed prompt sends to `api.typesafe.ai`: your prompt (first 4,000
characters) and each skill's name and one-line description. Never a skill's
full content. With about 90 skills that is roughly 7,000 input tokens and
200 to 450 ms per prompt.

## Development

```bash
claude --plugin-dir ../jev-mod --plugin-dir .
claude plugin validate .
claude plugin test .
```
