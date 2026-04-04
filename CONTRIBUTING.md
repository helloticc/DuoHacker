# Contributing to DuoHacker

Thank you for your interest in contributing to DuoHacker! This document outlines how to get started.

## Getting Started

1. **Fork & Clone**
   ```bash
   git clone https://github.com/your-username/DuoHacker.git
   cd DuoHacker
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or for fixes:
   # git checkout -b fix/your-fix-name
   ```

3. **Make Changes**
   - Write clean, readable JavaScript/Tampermonkey script code
   - Follow existing code style and patterns
   - Add comments for complex logic or API calls
   - Test thoroughly before submitting

4. **Commit & Push**
   ```bash
   git add .
   git commit -m "feat: describe your change"
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**
   - Go to GitHub and create a PR
   - Provide clear description of changes
   - Include testing details (e.g., "Tested on Duolingo lesson mode")
   - Reference any related issues

## Pull Request Guidelines

- **One feature per PR** - Keep PRs focused and manageable
- **Test on Duolingo** - Ensure it works in actual Duolingo environment
- **Resolve all conversations** - Address all feedback before merge
- **Update documentation** - If you change functionality, update relevant docs
- **No breaking changes** - Maintain backward compatibility when possible
- **Follow commit message format**:
  - `feat:` for new features (e.g., "feat: add hide profile toggle")
  - `fix:` for bug fixes (e.g., "fix: race condition in XP farming")
  - `docs:` for documentation
  - `refactor:` for code refactoring
  - `perf:` for performance improvements
  - `test:` for tests

## Code Style Guidelines

### Tampermonkey Script
- Use meaningful variable names
- Keep functions small and focused
- Add comments explaining "why", not "what"
- Remove `console.log()` and debug code before submitting
- Follow existing Duolingo API patterns
- Handle API errors gracefully

### Example:
```javascript
// Good
const probeSlugWithRetry = async (slug, maxRetries = 3) => {
  // Implement exponential backoff for rate limiting
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${DUOLINGO_API}/${slug}`);
      if (response.ok) return response.json();
    } catch (error) {
      if (i < maxRetries - 1) await delay(Math.pow(2, i) * 1000);
    }
  }
  return null;
};

// Avoid
const probe = async (s) => {
  let r = await fetch(s); // unclear variable names
  console.log(r); // debug logging left in
  return r;
};
```

## Feature Areas

Common areas for contribution:
- **UI/UX Improvements** - Settings panel, styling, user experience
- **XP Farming Logic** - Race detection, slug probing optimization
- **Performance** - Reduce API calls, optimize animations
- **Bug Fixes** - Fix race conditions, handle edge cases
- **Metadata** - GreasyFork description translations, SEO improvements
- **Documentation** - README, Wiki, inline code comments

## Testing

Before submitting a PR:

1. **Manual Testing**
   - Test on actual Duolingo (different languages, lesson types)
   - Test with various user scenarios (first farm, retry, 429 errors)
   - Check browser console for errors

2. **Edge Cases**
   - Test with slow internet (rate limiting scenarios)
   - Test with multiple concurrent operations
   - Test on different browsers (Chrome, Firefox, Safari)

## Review Process

1. Submit your PR with clear description
2. Project maintainer will review your code
3. Address any feedback or requested changes
4. Once approved, your PR will be merged
5. Your changes will be included in the next release on GreasyFork

## Questions or Ideas?

- **Bug Reports** - Open an issue with steps to reproduce
- **Feature Requests** - Open an issue describing the feature
- **Code Questions** - Comment on related PR or open a discussion
- **Join Discord** - https://discord.gg/Gvmd7deFtS

## Important Notes

- This is a Duolingo automation tool - use responsibly
- Respect Duolingo's Terms of Service
- No malicious features or code
- Keep the community safe and supportive

Thank you for contributing to DuoHacker! 🚀
