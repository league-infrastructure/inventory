---
status: pending
---

AGENTS: DO NOT IMPLEMENT YET. If the user has you suck up all the to-dos into sprints, inform the user that this one has been requested not to be implemented. 

# Gear Reservation System

## Idea

A reservation/scheduling feature that lets instructors and staff reserve
equipment kits for specific dates, events, and locations — preventing
double-allocation and coordinating gear logistics.

## Key Requirements (needs further design)

- **Calendar interface**: Either integrated with Google Calendar or a
  built-in calendar view showing kit availability by date.
- **Reservation flow**: A user says "I need a Robot Riot set on March 20"
  and the system checks availability for that date.
- **Conflict detection**: If a kit is already reserved or checked out for
  a date, the system flags the conflict. If the requesting instructor
  already has the gear checked out, it's automatically available.
- **Site logistics**: Track where gear needs to be shuttled from/to.
  If a kit is at Site A but needed at Site B, the system tracks the
  shuttle requirement, travel time, and who has custody during transit.
- **Event + travel time**: Reservations include not just the event
  window but also travel/setup/teardown time so the gear is blocked
  for the full period.
- **Remote site support**: Works for distributed sites and web-based
  booking.

## Open Design Questions

- Google Calendar integration vs. built-in calendar?
- How does reservation interact with the existing checkout/transfer
  system? Does a reservation auto-create a transfer on the start date?
- Should reservations be by kit number or by kit type/category
  (e.g., "any Robot Riot set")?
- Approval workflow — can anyone reserve, or does a quartermaster
  need to approve?
- Recurring reservations for regular classes?
- Notification system for upcoming reservations and shuttle needs?

## Status

This is an early-stage idea that needs significant design work before
it can be broken into sprints.
