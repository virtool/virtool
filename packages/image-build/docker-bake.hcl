variable "CONTEXT_ROOT" {
  default = ".docker-build"
}

target "web" {
  context = "${CONTEXT_ROOT}/web"
  dockerfile = "Dockerfile"
  target = "dist"
}

target "internal" {
  context = "${CONTEXT_ROOT}/internal"
  dockerfile = "Dockerfile"
  target = "internal"
}

target "create-sample-tools" {
  context = "."
  dockerfile = "packages/workflow-tools/Dockerfile"
  target = "create-sample"
}

target "create-sample" {
  context = "${CONTEXT_ROOT}/create-sample"
  dockerfile = "Dockerfile"
  target = "create-sample"
  contexts = { workflow-tools = "target:create-sample-tools" }
}

target "create-subtraction-tools" {
  context = "."
  dockerfile = "packages/workflow-tools/Dockerfile"
  target = "create-subtraction"
}

target "create-subtraction" {
  context = "${CONTEXT_ROOT}/create-subtraction"
  dockerfile = "Dockerfile"
  target = "create-subtraction"
  contexts = { workflow-tools = "target:create-subtraction-tools" }
}

target "pathoscope-tools" {
  context = "."
  dockerfile = "packages/workflow-tools/Dockerfile"
  target = "pathoscope"
}

target "pathoscope" {
  context = "${CONTEXT_ROOT}/pathoscope"
  dockerfile = "Dockerfile"
  target = "pathoscope"
  contexts = { workflow-tools = "target:pathoscope-tools" }
}

target "nuvs-tools" {
  context = "."
  dockerfile = "packages/workflow-tools/Dockerfile"
  target = "nuvs"
}

target "nuvs" {
  context = "${CONTEXT_ROOT}/nuvs"
  dockerfile = "Dockerfile"
  target = "nuvs"
  contexts = { workflow-tools = "target:nuvs-tools" }
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
