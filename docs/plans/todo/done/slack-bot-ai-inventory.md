---
status: done
sprint: '025'
tickets:
- '016'
---
# Slack bot for AI-powered inventory management

## Summary

Build a Slack application bot that connects to the AI model embedded in
the application. Users should be able to interact with the bot to:

Here is the manifest: config/slack_manifest.yaml. You may need to update this
file to account for the features you are implementing. 

The primary implementation here is to send messages from Slack to the chat
interface of the inventory system. It's primarily another window on the chat
interface, so the user doesn't have to log in to that account. But we could use
some of the Slack UI features. Like maybe a user can ask what Kit's or what they
have checked out to them, and then can use an interface to check things back in. 

1. **Check in/out kits** — tell the bot to check out or return kits via
   natural language commands.
2. **Manage inventory** — add, update, or query kits, packs, items, and
   computers through conversation.
3. **Upload photos for data extraction** — upload a picture of a
   Kit's label, including QR code and give the user an interface for checking that Kit in or out. 
