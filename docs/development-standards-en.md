# Development Standards Guide

## Table of Contents
1. [Git Usage Guidelines](#git-usage-guidelines)
    - [Branch Strategy](#branch-strategy)
    - [Commit Message Convention](#commit-message-convention)

## Git Usage Guidelines

### Branch Strategy

- `main`: Production environment branch, direct commits prohibited
- `develop`: Development environment branch, target for feature branch merges
- `feature/*`: New feature development (e.g., `feature/login-page`)
- `bugfix/*`: Bug fixes (e.g., `bugfix/login-error`)
- `hotfix/*`: Emergency fixes (resolving production issues)

### Commit Message Convention

Follow the Conventional Commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

- Types:
  - `feat`: Add new feature
  - `fix`: Fix a bug
  - `docs`: Documentation changes
  - `style`: Code style changes (no functionality changes)
  - `refactor`: Code refactoring
  - `perf`: Performance improvements
  - `test`: Add or modify test code
  - `chore`: Build task modifications, package manager modifications
  - `revert`: Revert to previous commit
  - `ci`: CI related changes
  - `build`: Build related changes
  - `wip`: Work in progress

- Rules:
  - Types are always lowercase
  - Scope is lowercase
  - Description starts with lowercase
  - No period at the end of description
  - Header (type, scope, description) should be within 100 characters

- Examples:
  ```
  feat(auth): add social login feature
  
  - Implement Google login
  - Implement Facebook login
  
  Closes #123
  ```

  ```
  fix(api): fix 404 error when retrieving user profile
  
  Fix API endpoint path typo and add exception handling
  
  Fixes #456
  ```

  ```
  chore(deps): update package dependencies
  
  - Update vue to v3.5.0
  - Update vite to v6.2.0
  ```
