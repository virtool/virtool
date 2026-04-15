---
name: pr
description: Push the current branch and create a pull request using gh.
---

# Make a PR using gh

- Command should look like: git push -u origin HEAD && gh pr create ...
- Avoid including checkboxes or post-PR task lists in the body.
- Don't include "Test Plan" section in PR body.
- Don't run `gh pr view` after creating the PR. Just return the URL.
