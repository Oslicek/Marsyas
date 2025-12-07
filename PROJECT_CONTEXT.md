# LilyAI01 - Project Context Summary

## Project Overview

**Type:** React Native mobile app with Expo + TypeScript  
**Navigation:** Expo Router (file-based routing)  
**State Management:** React hooks  
**Testing:** Jest with TDD workflow required

## Key Files & Structure

### Core Directories

```
app/                    # Expo Router screens
  (tabs)/              # Tab navigation (index, explore, activities)
  _layout.tsx          # Root layout
components/            # Reusable UI components
  themed-*.tsx         # Themed components for consistent styling
  ui/                  # Specialized UI components
services/              # Business logic layer (framework-agnostic)
  __tests__/           # Service unit tests
  storage/             # Storage abstraction layer
hooks/                 # Custom React hooks
constants/             # App constants (theme.ts)
data/                  # Static data (activities.json)
```

### Important Files

- `.cursorrules` - **Critical:** Project coding standards & TDD workflow
- `services/activities.ts` - Activities business logic
- `services/storage/activities-storage.ts` - Activities persistence
- `services/storage/storage-service.ts` - Generic storage service
- `data/activities.json` - Sample activities data (68 lines)

## Current Features

### Activities System

- **Storage:** Activities can be loaded/saved via storage services
- **Runtime:** `activities-storage-runtime.ts` provides runtime implementation
- **Tests:** Full test coverage in `services/__tests__/` and `services/storage/__tests__/`
- **Data:** Sample activities in JSON format with fields like name, category, duration

### Tab Navigation

- Home (`index.tsx`)
- Explore (`explore.tsx`)
- Activities (`activities.tsx`)

## Coding Standards (from .cursorrules)

### Critical Rules

1. **TDD Loop (Mandatory):**

   - Write failing test first → Implement → Pass test → Refactor → Run all tests → Commit
   - All business logic MUST have unit tests

2. **Separation of Concerns:**

   - Business logic → `services/` (no React/RN imports)
   - UI → `components/` (presentational)
   - Screens → `app/`
   - Reusable state logic → `hooks/`

3. **TypeScript:**
   - Strict mode enabled
   - No `any` (use `unknown` if needed)
   - Define interfaces for all data structures
   - Export types alongside implementation

### Naming Conventions

- **Files:** kebab-case (`user-profile.tsx`)
- **Components:** PascalCase (`UserProfile`)
- **Functions/Variables:** camelCase (`getUserData`)
- **Constants:** UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Types/Interfaces:** PascalCase (`UserData`)

### Import Order

1. React/React Native
2. Third-party libraries
3. Local components
4. Local services/hooks
5. Types
6. Constants/assets

### Best Practices

- Use `expo-image` instead of RN `Image`
- Use themed components for consistent styling
- Keep components < 200 lines
- Handle loading/error states
- Use accessibility props
- Services must be framework-agnostic & testable

### Avoid

- ❌ Business logic in components
- ❌ `var` keyword
- ❌ Ignoring TypeScript errors
- ❌ Deeply nested component trees
- ❌ Complex inline styles
- ❌ Commented-out code in commits

## Code Style

- 2 spaces indentation
- Semicolons required
- Single quotes (unless nested)
- Template literals for interpolation
- Destructuring preferred
- Arrow functions preferred

## Git Workflow

- Clear, descriptive commits
- Atomic, focused commits
- Branch prefixes: `feature/`, `bugfix/`, `hotfix/`

## Testing Setup

- **Framework:** Jest
- **Config:** `jest.config.js`, `jest.setup.js`
- **Tests Location:** `__tests__/` directories within feature folders
- **Coverage Required:** All business logic (services layer)

## Scripts Available

- `start-expo.bat` - Start development server
- `scripts/reset-project.js` - Reset to blank project
- `scripts/test-load-activities.ts` - Test script for activities

## Dependencies (Key)

- Expo SDK
- React Native
- TypeScript
- Jest (testing)
- Expo Router (navigation)

## Development Status

- ✅ Basic app structure established
- ✅ Tab navigation configured
- ✅ Activities service with storage layer
- ✅ Unit tests for services
- ✅ Theming system in place
- 📝 Ready for feature development

## Notes for Next Session

- Follow TDD loop strictly (test → implement → pass → refactor → commit)
- Keep services framework-agnostic
- Use typed interfaces for all data
- Check `.cursorrules` for detailed guidelines
- All new business logic needs tests before implementation

## Quick Start Commands

```bash
npm install              # Install dependencies
npx expo start          # Start dev server
npm test                # Run tests
npm run reset-project   # Reset to blank slate
```

---

_Last Updated: 2025-11-03_  
_Context Window: 1M tokens_

