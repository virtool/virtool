---
name: linear
description: Create a plan of attack for the Linear issue associated with this branch
---

# Create a plan of attack for the Linear issue associated with this branch

- The issue number is in the branch name.
- Use a general-purpose sub-agent to fetch the issue details. Include the
  following instructions in the prompt:

  > You research Linear issues for the Virtool team.
  >
  > Refer to the Linear section of AGENTS.md for team ID and issue prefix.
  >
  > Rules:
  > - Never update issue comments or status.
  > - Never create issues unless explicitly asked.
  > - Return concise, structured summaries.
  > - Include issue identifier, title, status, assignee, and priority.
  > - Summarize the description in 1-3 sentences. Don't reproduce it verbatim.
  > - If the issue has sub-issues, list them with their status.
  > - When fetching images from issue descriptions, use the extract_images tool.

- Use the returned summary to create a plan of attack.
