## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Weekly issue draft (file I/O only)

Automated step: `npm run fetch:kouhou` → PDFs under `data/kouhou/`.

Drafting is **not** wired to a vendor LLM in this repo. Follow [`scripts/draft-prompt.md`](./scripts/draft-prompt.md) (I/O contract + article shape). Checklist helper:

```
npm run draft -- --vol N --date YYYY-MM-DD
```

Operators currently use a Cursor agent for the draft step (policy). That is not a runtime dependency — do not call Cursor or other LLM APIs from core fetch/content scripts. Write `src/content/posts/vol-N.md`, then stop for human review (no auto-push).

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
