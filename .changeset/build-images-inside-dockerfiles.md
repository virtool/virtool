---
virtool: patch
create-sample: patch
create-subtraction: patch
pathoscope: patch
nuvs: patch
---

Build each image from source inside its Dockerfile

The image contents do not change. Each image now installs, builds, and
packages its app inside the Docker build, so a local build and a CI build use
the same steps.
