# Data Model: Root Compose Dev Stack and Backend Cleanup

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15

## Application database

**No changes.** PostgreSQL schema, Knex migrations, and tenant (`hotel_id`) rules are unchanged.

## Configuration artifacts (repository)

These are not database entities but bounded concepts for implementation tasks:

| Artifact | Responsibility |
|----------|----------------|
| Root compose base file | Declares services, default dev behavior, profiles (`workers`, `infra`, `tools`) |
| Root compose production overlay | Overrides builds, env, volumes for production-like runs |
| Root env example | Documents required and optional variables for compose interpolation |
| Backend Dockerfiles | Image build instructions; contexts referenced from root compose |

## State transitions

N/A (no transactional business data in this feature).
