# Tests

Current test coverage is fixture-backed Hermes event smoke checking.

## Fixtures

- `fixtures/hermes-events/gateway-ready.json`
- `fixtures/hermes-events/message-stream.jsonl`
- `fixtures/hermes-events/tool-lifecycle.jsonl`
- `fixtures/hermes-events/approval-request.json`
- `fixtures/hermes-events/clarify-request.json`

## Command

```bash
bun scripts/check-hermes-events.ts
```

This is not a full test runner. It directly imports the reducer and validates event mapping, blocking prompt queue behavior, custom UI/session actions, and reasoning/thinking deltas.
