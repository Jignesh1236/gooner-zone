
# Security Policy

## Supported Versions

Currently supported versions of Gooner Zone with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

We take the security of Gooner Zone seriously. If you discover a security vulnerability, please follow these steps:


### What to Expect

- **Initial Response**: You can expect an acknowledgment within 48 hours
- **Status Updates**: We'll provide updates every 7 days on the progress
- **Resolution Timeline**: We aim to resolve critical vulnerabilities within 30 days
- **Disclosure**: Once fixed, we'll coordinate disclosure timing with you

### Security Considerations

This app handles:
- User reading history and preferences (stored locally)
- Downloaded manga chapters (stored locally on device)
- API interactions with MangaDex

**Note**: No user account data or payment information is collected or stored by this application.

### Best Practices for Users

1. Only download the app from official sources
2. Keep your app updated to the latest version
3. Review app permissions before installation
4. Report suspicious behavior immediately

### Scope

Security issues we consider in scope:
- Authentication/authorization bypasses
- Data leakage or privacy violations
- API abuse or rate limiting issues
- Code injection vulnerabilities
- Unsafe data storage practices

Out of scope:
- Issues in third-party dependencies (report to respective maintainers)
- MangaDex API vulnerabilities (report to MangaDex directly)

## Third-Party Services

This app uses:
- **MangaDex API**: For manga content and metadata
- **Expo Services**: For app development and deployment

Please report vulnerabilities in these services directly to their respective security teams.

## Attribution

We appreciate security researchers who responsibly disclose vulnerabilities. With your permission, we'll acknowledge your contribution in our release notes.
