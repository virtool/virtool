#!/bin/sh
set -eu

ADMIN_URL="http://garage:3903"
ADMIN_TOKEN="virtool-test-admin-token"
AUTH="Authorization: Bearer ${ADMIN_TOKEN}"

BUCKET="virtool-test"
ACCESS_KEY_ID="GK000000000000000000000001"
SECRET_ACCESS_KEY="0000000000000000000000000000000000000000000000000000000000000001"

apk add --no-cache curl jq >/dev/null

until curl -sf -H "${AUTH}" "${ADMIN_URL}/health" >/dev/null; do
  sleep 1
done

NODE_ID=$(curl -sf -H "${AUTH}" "${ADMIN_URL}/v1/status" | jq -r '.node')

CURRENT_VERSION=$(curl -sf -H "${AUTH}" "${ADMIN_URL}/v1/layout" | jq -r '.version')

if [ "${CURRENT_VERSION}" = "0" ]; then
  curl -sf -X POST -H "${AUTH}" -H "Content-Type: application/json" \
    -d "[{\"id\":\"${NODE_ID}\",\"zone\":\"dc1\",\"capacity\":1000000000,\"tags\":[]}]" \
    "${ADMIN_URL}/v1/layout" >/dev/null
  curl -sf -X POST -H "${AUTH}" -H "Content-Type: application/json" \
    -d '{"version":1}' \
    "${ADMIN_URL}/v1/layout/apply" >/dev/null
fi

BUCKET_ID=$(curl -s -H "${AUTH}" "${ADMIN_URL}/v1/bucket?globalAlias=${BUCKET}" | jq -r '.id // empty')
if [ -z "${BUCKET_ID}" ]; then
  BUCKET_ID=$(curl -sf -X POST -H "${AUTH}" -H "Content-Type: application/json" \
    -d "{\"globalAlias\":\"${BUCKET}\"}" \
    "${ADMIN_URL}/v1/bucket" | jq -r '.id')
fi

EXISTING_KEY=$(curl -s -H "${AUTH}" "${ADMIN_URL}/v1/key?id=${ACCESS_KEY_ID}" | jq -r '.accessKeyId // empty')
if [ -z "${EXISTING_KEY}" ]; then
  curl -sf -X POST -H "${AUTH}" -H "Content-Type: application/json" \
    -d "{\"accessKeyId\":\"${ACCESS_KEY_ID}\",\"secretAccessKey\":\"${SECRET_ACCESS_KEY}\",\"name\":\"virtool-test-key\"}" \
    "${ADMIN_URL}/v1/key/import" >/dev/null
fi

curl -sf -X POST -H "${AUTH}" -H "Content-Type: application/json" \
  -d "{\"bucketId\":\"${BUCKET_ID}\",\"accessKeyId\":\"${ACCESS_KEY_ID}\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":false}}" \
  "${ADMIN_URL}/v1/bucket/allow" >/dev/null

echo "garage bootstrap ok: bucket=${BUCKET} key=${ACCESS_KEY_ID}"
