FROM alpine:3.21

RUN apk add --no-cache gcc musl-dev coreutils \
    && adduser -D -u 10001 runner \
    && mkdir -p /workspace \
    && chown runner:runner /workspace

USER runner
WORKDIR /tmp

CMD ["gcc", "--version"]
