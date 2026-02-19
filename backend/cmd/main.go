package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"teampulse/internal/database"
	"teampulse/internal/handlers"
	mw "teampulse/internal/middleware"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"
)

func main() {
	// Database
	database.Connect()
	database.Migrate()

	// Echo
	e := echo.New()
	e.HideBanner = true

	// Global middleware
	e.Use(echomw.Logger())
	e.Use(echomw.Recover())

	// CORS: read allowed origins from env, fallback to * for dev
	origins := []string{"*"}
	if env := os.Getenv("CORS_ORIGINS"); env != "" {
		origins = strings.Split(env, ",")
	}
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: origins,
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Authorization", "Content-Type"},
	}))

	// Health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "ok"})
	})

	// Rate limiter for login: ~5 requests per minute per IP
	loginRateStore := echomw.NewRateLimiterMemoryStoreWithConfig(
		echomw.RateLimiterMemoryStoreConfig{
			Rate:      rate.Every(12 * time.Second), // refill 1 token every 12s = 5/min
			Burst:     5,
			ExpiresIn: 3 * time.Minute,
		},
	)
	loginRateLimiter := echomw.RateLimiterWithConfig(echomw.RateLimiterConfig{
		Store: loginRateStore,
		IdentifierExtractor: func(ctx echo.Context) (string, error) {
			return ctx.RealIP(), nil
		},
		DenyHandler: func(ctx echo.Context, identifier string, err error) error {
			return ctx.JSON(http.StatusTooManyRequests, map[string]string{
				"error": "too many login attempts, please try again later",
			})
		},
	})

	// ─── Public Routes ────────────────────────────────────────
	e.POST("/api/auth/login", handlers.Login, loginRateLimiter)

	// ─── Authenticated Routes ─────────────────────────────────
	api := e.Group("/api", mw.JWTMiddleware)

	// Auth
	api.GET("/auth/me", handlers.GetMe)

	// Time Clock (employee self-service)
	api.POST("/clock/in", handlers.ClockIn)
	api.POST("/clock/out", handlers.ClockOut)
	api.GET("/clock/status", handlers.GetClockStatus)
	api.GET("/clock/entries", handlers.GetTimeEntries)

	// Activity Pings (employee browser sends these)
	api.POST("/activity/ping", handlers.RecordActivityPing)

	// Task time tracking
	api.POST("/tasks/:id/timer/start", handlers.StartTaskTimer)
	api.POST("/tasks/timer/stop", handlers.StopTaskTimer)
	api.GET("/tasks/timer/active", handlers.GetActiveTimer)

	// Tasks
	api.GET("/tasks", handlers.ListTasks)
	api.POST("/tasks", handlers.CreateTask)
	api.PUT("/tasks/:id", handlers.UpdateTask)
	api.DELETE("/tasks/:id", handlers.DeleteTask)

	// KPIs
	api.GET("/kpis", handlers.ListKPIs)
	api.POST("/kpis", handlers.CreateKPI)
	api.PUT("/kpis/:id", handlers.UpdateKPI)
	api.DELETE("/kpis/:id", handlers.DeleteKPI)

	// Standups
	api.GET("/standups", handlers.ListStandups)
	api.POST("/standups", handlers.CreateStandup)
	api.DELETE("/standups/:id", handlers.DeleteStandup)

	// ─── Admin Routes ─────────────────────────────────────────
	admin := api.Group("", mw.AdminOnly)

	admin.POST("/employees", handlers.RegisterEmployee)
	admin.GET("/employees", handlers.ListEmployees)
	admin.PUT("/employees/:id", handlers.UpdateEmployee)
	admin.DELETE("/employees/:id", handlers.DeactivateEmployee)
	admin.GET("/dashboard", handlers.GetDashboard)
	admin.GET("/activity/stats", handlers.GetActivityStats)

	// Serve static frontend in production
	e.Static("/", "static")

	// Start
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("TeamPulse starting on :%s", port)
	e.Logger.Fatal(e.Start(":" + port))
}
