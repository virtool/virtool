---
virtool: patch
---

Prevent a second delete from a confirmation dialog

When you click **Confirm** in a delete or remove dialog, Virtool now disables the dialog until the action is complete. A double click no longer sends the action two times. When the dialog closes, focus goes back to the button that opened it, if that button is still on the page.
