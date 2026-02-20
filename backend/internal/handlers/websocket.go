package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	mw "teampulse/internal/middleware"
	"teampulse/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/net/websocket"
)

// ─── WebSocket Hub ───────────────────────────────────────────

type wsHub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]bool
}

var monitorHub = &wsHub{
	clients: make(map[*websocket.Conn]bool),
}

func (h *wsHub) register(ws *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[ws] = true
}

func (h *wsHub) unregister(ws *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, ws)
	ws.Close()
}

func (h *wsHub) broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ws := range h.clients {
		if err := websocket.Message.Send(ws, string(msg)); err != nil {
			go h.unregister(ws)
		}
	}
}

// BroadcastMonitorUpdate sends a monitoring update to all connected admin clients
func BroadcastMonitorUpdate(eventType string, data interface{}) {
	msg, err := json.Marshal(map[string]interface{}{
		"type": eventType,
		"data": data,
	})
	if err != nil {
		return
	}
	monitorHub.broadcast(msg)
}

// ─── WebSocket Endpoint ──────────────────────────────────────

// MonitorWebSocket handles admin WebSocket connections for live monitoring
func MonitorWebSocket(c echo.Context) error {
	websocket.Handler(func(ws *websocket.Conn) {
		monitorHub.register(ws)
		defer monitorHub.unregister(ws)

		log.Printf("WebSocket client connected (total: %d)", len(monitorHub.clients))

		// Keep connection alive by reading (blocks until disconnect)
		for {
			var msg string
			if err := websocket.Message.Receive(ws, &msg); err != nil {
				break
			}
			// We don't expect client messages, just keep reading to detect disconnect
		}

		log.Printf("WebSocket client disconnected")
	}).ServeHTTP(c.Response(), c.Request())

	return nil
}

// WsAuthMiddleware checks JWT from query param for WebSocket connections
func WsAuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		// WebSocket connections can't easily send headers, so we accept token as query param
		token := c.QueryParam("token")
		if token == "" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "token required"})
		}

		// Validate token manually
		t, err := jwt.ParseWithClaims(token, &mw.JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
			return mw.GetJWTSecret(), nil
		})
		if err != nil || !t.Valid {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
		}

		claims, ok := t.Claims.(*mw.JWTClaims)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid claims"})
		}

		if claims.Role != models.RoleAdmin {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "admin access required"})
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)

		return next(c)
	}
}
