---
status: done
sprint: '025'
tickets:
- 018
---

# Fix Slack bot email lookup — add users:read.email scope

## Summary

The Slack bot can't find user emails because the bot token lacks the
`users:read.email` scope. The Slack API's `users.info` endpoint only
returns the `profile.email` field when this scope is granted.

## What happened

- User sent "hey what do I have checked out?" to @Inventory Bot
- Bot replied: "I couldn't find your email in Slack."
- The user's email IS in their Slack profile, but the API won't return
  it without the proper scope

## What was done

- Updated `config/slack_manifest.yaml` to include `users:read` and
  `users:read.email` scopes
- The manifest change is committed but the Slack app needs to be
  **reinstalled** in the workspace to pick up new OAuth scopes

## Action required

1. Go to https://api.slack.com/apps → select **Inventory Bot**
2. Go to **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**
3. Verify `users:read` and `users:read.email` are listed (add if not)
4. Go to **Install App** → click **Reinstall to Workspace**
5. Approve the new permissions
6. Test by DMing the bot again

After reinstall, the bot token will have permission to read emails
and should successfully map Slack users to inventory accounts.
