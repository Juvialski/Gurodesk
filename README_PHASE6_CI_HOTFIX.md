# Phase 6 CI hotfix

Date: 2026-08-10

This hotfix addresses the two release-gate failures discovered after the universal-curriculum ZIP was pushed:

1. Phase 4.2/4.4 validators still expected the abandoned `callGeminiWithDiscoveredFallback` experiment. They now validate the shipped `callWithLiteFallback` implementation and explicitly reject reintroduction of the abandoned discovery helper.
2. `publish_custom_curriculum` raised PostgreSQL SQLSTATE `42702` because its local `subject_id` variable was ambiguous with table columns. Additive migration `026` replaces only that RPC with the same behavior using `published_subject_id`. Migration 025 is left unchanged because it may already be applied.

The Gemini 3.5 Flash-Lite / 3.1 Flash-Lite BYOK policy is unchanged.
