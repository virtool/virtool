---
name: plan
description: Create a plan of attack for the Linear issue associated with the current branch.
---

# Create a plan of attack for the Linear issue associated with this branch

- The issue number is in the branch name.
- Use a general-purpose sub-agent to fetch the issue details. The sub-agent
  should return the issue identifier, title, status, assignee, and priority.
  Summarize the description in 1-3 sentences. If the issue has sub-issues,
  list them with their status.
- Use the returned summary to create a plan of attack.
