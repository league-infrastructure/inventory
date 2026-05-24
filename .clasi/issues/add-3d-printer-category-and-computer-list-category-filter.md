---
status: pending
---

# Add 3D printer category and computer list category filter

## Description

Add 3D printers as a hardware type that works just like computers:
they can be part of a kit, and they can be loaned out on their own.

### Scope

1. **Add "3D printer" category.** The stakeholder will handle adding
   the category value itself.
2. **Show category on the computer list.** The computer list page
   currently does not display the category column. Add it.
3. **Filter the computer list by category.** Users should be able to
   filter the computer list by category (so they can view only 3D
   printers, only desktops, etc.).
4. **Add category to the new computer form.** The form for creating a
   new computer should include a category field.

### Notes

- 3D printers reuse the existing computer/hardware model — no new
  entity type. The category field is the differentiator.
- Kit membership and loan flows already work generically over
  computers, so they should automatically support 3D printers once
  the category exists and is selectable.
