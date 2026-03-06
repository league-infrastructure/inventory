# Add toast notification system

## Summary

The app needs a toast notification system — brief messages that appear,
persist for a few seconds, then fade away. Toasts should be used for
confirmations and errors across the app.

## Behavior

- Toast appears at a consistent position (e.g., top-right)
- Stays visible for a few seconds, then fades out
- Non-blocking — user can continue interacting with the page

## Use Cases

- **Kit retired**: After retiring a kit, navigate back to the kit list
  and show a toast confirming the kit was retired
- **Errors**: Validation failures, failed API calls, permission issues
- **Other confirmations**: Any significant state change that the user
  should be aware of

## Kit Retirement Flow

When the user clicks "Retire" on a kit:
1. Retire the kit via API
2. Navigate back to the kit list
3. Show a toast: "Kit #N retired"
