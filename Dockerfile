# ─── Build Stage ─────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /teampulse ./cmd/main.go

# ─── Production Stage ────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /teampulse .
COPY --from=builder /app/static/ ./static/

# Copy agent zip if it was included in the build context
# Uses a wildcard so it won't fail if the file is missing (LFS not pulled)
COPY --from=builder /app/agent/TeamPulseAgent.zi[p] ./agent/

RUN mkdir -p screenshots agent

EXPOSE 8080

CMD ["./teampulse"]
