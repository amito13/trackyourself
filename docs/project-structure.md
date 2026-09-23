# Project structure

The folders follow PRD sections 36–38. Empty folders contain `.gitkeep`
placeholders; screens and application behavior are not implemented by this setup.

```text
src/
├── app/                     # Expo Router screens and layouts only
│   ├── _layout.tsx          # Existing root navigator
│   ├── index.tsx            # Existing entry screen
│   ├── (auth)/              # Existing sign-in screen and layout
│   ├── auth/                # Existing OAuth callback
│   ├── onboarding/          # Planned days, body-parts, exercises screens
│   ├── (tabs)/              # Planned home, history, profile screens
│   ├── workout/             # Planned [sessionId].tsx
│   │   ├── exercise/        # Planned [sessionExerciseId].tsx
│   │   └── summary/         # Planned [sessionId].tsx
│   ├── history/             # Planned [sessionId].tsx
│   │   └── exercise/        # Planned [sessionExerciseId].tsx
│   └── plan/                # Planned edit.tsx
├── components/              # Shared UI components
├── features/
│   ├── auth/
│   ├── onboarding/
│   ├── workout/
│   ├── history/
│   ├── profile/
│   └── sync/
├── db/
│   ├── sqlite/              # Local database initialization and access
│   ├── repositories/        # Persistence operations used by features
│   └── migrations/          # Database schema migrations
├── lib/
│   ├── supabase/            # Future Supabase support modules
│   ├── network/             # Connectivity helpers
│   └── …                    # Existing auth, Supabase, and crypto helpers
├── stores/                  # New Zustand application/UI stores
├── state/                   # Existing auth store, retained with its imports
├── hooks/                   # Existing use-auth hook and future shared hooks
├── types/                   # Shared TypeScript types
├── constants/               # Shared constants
└── utils/                   # Shared utilities
```

Keep the existing authentication routes instead of adding a second `login.tsx`.
Existing helpers such as `src/lib/supabase.ts` remain in place; the adjacent
`supabase/` folder is reserved for additional modules. Keep the existing auth
store in `state/` until an intentional migration updates its consumers.

Create route files and navigator layouts when implementing their screens. Keep
components, stores, database code, and documentation outside `src/app/`.
SQLite will own persistent local workout records; Zustand will hold application
and UI state. Route components should use feature logic and repositories rather
than embedding SQL or synchronization logic.
