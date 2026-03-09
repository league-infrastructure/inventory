---
status: pending
---

# Slack bot email lookup requires app reinstall

The Slack bot can't read user emails because the `users:read.email` OAuth
scope wasn't granted when the app was originally installed. The manifest
(`config/slack_manifest.yaml`) now includes both `users:read` and
`users:read.email` scopes, but the app must be reinstalled in the Slack
workspace to pick up the new permissions.

## Problem

When eric.busboom sent "hey what do I have checked out?" to the bot, it
replied "I couldn't find your email in Slack." The `users.info` API call
returns the user profile but omits the `email` field unless the bot has
the `users:read.email` scope granted at install time.

The code has a display-name fallback, but email is the primary and most
reliable way to map Slack users to inventory accounts.

## Action required

1. Go to the Slack app management page (api.slack.com/apps).
2. Select the Inventory Bot app.
3. Go to **Install App** and click **Reinstall to Workspace**.
4. Approve the new scopes when prompted.
5. If the bot token changes after reinstall, update the
   `slack_bot_user_oauth_token` Docker Swarm secret:
   ```bash
   echo "xoxb-NEW-TOKEN" | docker secret create slack_bot_user_oauth_token_v2 -
   # Then update docker-compose.yml to reference the new secret version
   # and redeploy
   ```
6. Verify by DMing the bot — it should now resolve email addresses.
