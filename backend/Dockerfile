# ─── Build Stage ─────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app
COPY . .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /teampulse ./cmd/main.go

# ─── Production Stage ────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /teampulse .
COPY --from=builder /app/static/ ./static/

EXPOSE 8080

CMD ["./teampulse"]
