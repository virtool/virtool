# Set by the release job. Local builds and pull requests leave them empty, so
# the web build skips the Sentry source-map upload.
variable "SENTRY_AUTH_TOKEN" {
  default = ""
}

variable "SENTRY_RELEASE" {
  default = ""
}

target "_app-build" {
  context = "."
  dockerfile = "packages/image-build/Dockerfile"
  target = "deploy"
}

target "web-build" {
  inherits = ["_app-build"]
  target = "build"
  args = { APP = "@virtool/web", RELEASE = SENTRY_RELEASE }
  secret = SENTRY_AUTH_TOKEN == "" ? [] : ["type=env,id=SENTRY_AUTH_TOKEN"]
}

target "web" {
  context = "."
  dockerfile = "apps/web/Dockerfile"
  target = "dist"
  contexts = { app = "target:web-build" }
}

target "internal-build" {
  inherits = ["_app-build"]
  args = { APP = "@virtool/internal" }
}

target "internal" {
  context = "."
  dockerfile = "apps/internal/Dockerfile"
  target = "internal"
  contexts = { app = "target:internal-build" }
}

target "create-sample-tools" {
  context = "."
  dockerfile = "packages/workflow-tools/Dockerfile"
  target = "create-sample"
}

target "create-sample-build" {
  inherits = ["_app-build"]
  args = { APP = "@virtool/create-sample" }
}

target "create-sample" {
  context = "."
  dockerfile = "apps/create-sample/Dockerfile"
  target = "create-sample"
  contexts = {
    app = "target:create-sample-build"
    workflow-tools = "target:create-sample-tools"
  }
}

target "create-subtraction-tools" {
  context = "."
  dockerfile = "packages/workflow-tools/Dockerfile"
  target = "create-subtraction"
}

target "create-subtraction-build" {
  inherits = ["_app-build"]
  args = { APP = "@virtool/create-subtraction" }
}

target "create-subtraction" {
  context = "."
  dockerfile = "apps/create-subtraction/Dockerfile"
  target = "create-subtraction"
  contexts = {
    app = "target:create-subtraction-build"
    workflow-tools = "target:create-subtraction-tools"
  }
}

target "pathoscope-tools" {
  context = "."
  dockerfile = "packages/workflow-tools/Dockerfile"
  target = "pathoscope"
}

target "pathoscope-build" {
  inherits = ["_app-build"]
  args = { APP = "@virtool/pathoscope" }
}

target "pathoscope" {
  context = "."
  dockerfile = "apps/pathoscope/Dockerfile"
  target = "pathoscope"
  contexts = {
    app = "target:pathoscope-build"
    workflow-tools = "target:pathoscope-tools"
  }
}

target "nuvs-tools" {
  context = "."
  dockerfile = "packages/workflow-tools/Dockerfile"
  target = "nuvs"
}

target "nuvs-build" {
  inherits = ["_app-build"]
  args = { APP = "@virtool/nuvs" }
}

target "nuvs" {
  context = "."
  dockerfile = "apps/nuvs/Dockerfile"
  target = "nuvs"
  contexts = {
    app = "target:nuvs-build"
    workflow-tools = "target:nuvs-tools"
  }
}

target "bowtie2" {
  context = "."
  dockerfile = "packages/workflow-tools/Dockerfile"
  target = "bowtie2"
}

target "pathoscope-core-test" {
  context = "."
  dockerfile = "packages/workflow-tools/Dockerfile"
  target = "pathoscope-test"
  output = ["type=cacheonly"]
}
