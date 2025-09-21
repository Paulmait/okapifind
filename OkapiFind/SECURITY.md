# Security Guidelines for OkapiFind

## Important: Protect Your API Keys

This project uses sensitive API keys and configuration. Follow these guidelines to keep your app secure:

### Never Commit Sensitive Data

The following should NEVER be committed to version control:
- `.env` files containing actual API keys
- `google-services.json` (Android)
- `GoogleService-Info.plist` (iOS)
- Any file containing API keys or secrets

### Environment Variables

1. Copy `.env.example` to `.env`
2. Add your actual API keys to `.env`
3. Never share or commit `.env`

### Firebase Security

Your Firebase configuration includes:
- **Project ID**: okapifind-e5b81
- **Project Number**: 897907860773
- **Web API Key**: Keep this secret!

### What's Safe to Commit

- `.env.example` (with placeholder values)
- Code that references environment variables
- Configuration files without actual keys

### If Keys Are Exposed

If you accidentally commit API keys:
1. Immediately regenerate the keys in Firebase Console
2. Update your local `.env` file
3. Remove the commit from history using `git filter-branch` or BFG Repo-Cleaner
4. Force push the cleaned history

### Secure Storage

For production:
- Use environment variables in your CI/CD pipeline
- Store secrets in secure services like AWS Secrets Manager or Azure Key Vault
- Enable Firebase App Check for additional security

### Contact

Security concerns: guampaul@gmail.com