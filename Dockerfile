# Minimal isolated C compiler/runtime image used by PLBD.
FROM alpine:3.21

RUN apk add --no-cache build-base coreutils

WORKDIR /workspace

# The backend overrides this user at runtime and supplies a read-only
# source mount plus a restricted writable /tmp filesystem.
