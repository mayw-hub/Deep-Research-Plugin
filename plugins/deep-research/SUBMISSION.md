## Description

Deep Research is a multi-step research workflow and MCP server for literature searching, source screening, identifier verification and cited reports.

## Capabilities

Interactive, Read, Write.

## Data and network behavior

The plugin fetches requested public pages and PDFs and Europe PMC records and full text. It writes plans, source ledgers, search logs and reports to the configured research directory. The plugin collects or sends no other data; Europe PMC queries contain only the search terms the agent chose.

## Security

SSRF protections refuse private, loopback, link-local, CGNAT and metadata ranges; DNS is pinned. Fetches allow at most 5 redirects, 10MB and 20 seconds.

## Test prompts

- Review the literature on a clinical topic with an evidence table. Expected: search, screen and verify sources and assemble a cited report.
- Compare technical options with cited sources. Expected: combine Europe PMC and host web search when relevant and identify uncertainty.
- Prepare a cited briefing for a talk with figures. Expected: identify verified figure numbers and assemble a report with references.

## Known limits

No built-in general web search; literature search covers Europe PMC only. Access to publisher full text varies. Model quality differs from OpenAI's RL-tuned model.

## Owner-supplied items (TODO, do not invent)

- [x] Homepage or repository URL: https://github.com/mayw-hub/Deep-Research-Plugin
- [x] Privacy policy URL: https://github.com/mayw-hub/Deep-Research-Plugin/blob/main/PRIVACY.md (the file must be pushed to the `main` branch for the link to work)
- [x] Terms of service URL: https://github.com/mayw-hub/Deep-Research-Plugin/blob/main/TERMS.md (same)
- [x] Support contact: https://github.com/mayw-hub/Deep-Research-Plugin/issues (GitHub Issues must be enabled; add an email if the submission form requires one)
- [ ] Screenshots

Recheck the current OpenAI plugin submission requirements before submitting.
