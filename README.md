# skill-router

A Claude Code mod that loads the right skills on its own. On every prompt it
asks [Jev](https://typesafe.ai) whether each skill fits, shows the ones over the
threshold ranked above the prompt, and has the model load them before it starts.

```
Jev · tdd 0.95 ✓ · animate 0.86 ✓ (327 ms)
```

## How it works

- One Noul question per skill, all in one request. Each skill gets its own
  probability, so two fitting skills can both pass, and none at all is a normal
  outcome.
- Skills at or over the threshold are ranked; the top ones, up to the maximum,
  are loaded. If none passes, nothing is attached.
- Loading is a hidden instruction telling the model to call the Skill tool for
  each one, in order. A mod cannot load skill content itself: the Skill tool
  does not hand its content back to a plugin.
- Fails open: a timeout, an outage or a missing key only skips the routing,
  and the band says why.
- Skips slash commands, prompts under 12 characters, and prompts not typed by you.

## Options

Set in `/plugin` → Installed → skill-router → Configure options.

| Option | Default | Meaning |
| --- | --- | --- |
| Threshold | 0.8 | Probability a skill needs to be shown and loaded |
| Max skills | 3 | Most skills loaded per prompt, highest first |
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
