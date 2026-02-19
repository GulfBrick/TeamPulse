package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"teampulse/internal/database"
	mw "teampulse/internal/middleware"
	"teampulse/internal/models"

	"github.com/labstack/echo/v4"
)

// RecordAgentHeartbeat receives tracking data from the desktop agent.
func RecordAgentHeartbeat(c echo.Context) error {
	userID := mw.GetUserID(c)

	var req models.AgentHeartbeatRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	hb := models.AgentHeartbeat{
		UserID:            userID,
		Timestamp:         time.Now(),
		MouseMoves:        req.MouseMoves,
		MouseClicks:       req.MouseClicks,
		Keystrokes:        req.Keystrokes,
		ScrollEvents:      req.ScrollEvents,
		ActiveApp:         req.ActiveApp,
		ActiveWindowTitle: req.ActiveWindowTitle,
		IdleSeconds:       req.IdleSeconds,
	}
	database.DB.Create(&hb)

	return c.JSON(http.StatusOK, map[string]string{"status": "recorded"})
}

// UploadScreenshot receives a screenshot from the desktop agent.
func UploadScreenshot(c echo.Context) error {
	userID := mw.GetUserID(c)

	file, err := c.FormFile("screenshot")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no screenshot file"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file"})
	}
	defer src.Close()

	// Store screenshots locally in screenshots/ directory
	screenshotDir := "screenshots"
	os.MkdirAll(screenshotDir, 0755)

	filename := fmt.Sprintf("%d_%d.png", userID, time.Now().UnixMilli())
	destPath := filepath.Join(screenshotDir, filename)

	dst, err := os.Create(destPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save file"})
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to write file"})
	}

	imageURL := "/screenshots/" + filename
	ss := models.Screenshot{
		UserID:    userID,
		Timestamp: time.Now(),
		ImageURL:  imageURL,
	}
	database.DB.Create(&ss)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":    "uploaded",
		"image_url": imageURL,
	})
}

// GetScreenshots returns screenshots for admin viewing.
func GetScreenshots(c echo.Context) error {
	var screenshots []models.Screenshot
	database.DB.Preload("User").Order("timestamp desc").Limit(100).Find(&screenshots)
	return c.JSON(http.StatusOK, screenshots)
}

// GetAgentMonitor returns aggregated agent monitoring data for each employee (today).
func GetAgentMonitor(c echo.Context) error {
	today := todayStr()
	startOfDay, _ := time.Parse("2006-01-02", today)
	endOfDay := startOfDay.Add(24 * time.Hour)

	var employees []models.User
	database.DB.Where("is_active = true AND role = ?", models.RoleEmployee).Find(&employees)

	var entries []models.AgentMonitorEntry

	for _, emp := range employees {
		entry := models.AgentMonitorEntry{
			UserID:   emp.ID,
			UserName: emp.Name,
		}

		// Get latest heartbeat for current app info
		var latest models.AgentHeartbeat
		if err := database.DB.Where("user_id = ? AND timestamp >= ? AND timestamp < ?", emp.ID, startOfDay, endOfDay).
			Order("timestamp desc").First(&latest).Error; err == nil {
			entry.ActiveApp = latest.ActiveApp
			entry.ActiveWindowTitle = latest.ActiveWindowTitle
		}

		// Aggregate event counts for today
		type Sums struct {
			MouseMoves   int
			MouseClicks  int
			Keystrokes   int
			ScrollEvents int
			Count        int
		}
		var sums Sums
		database.DB.Model(&models.AgentHeartbeat{}).
			Select("COALESCE(SUM(mouse_moves),0) as mouse_moves, COALESCE(SUM(mouse_clicks),0) as mouse_clicks, COALESCE(SUM(keystrokes),0) as keystrokes, COALESCE(SUM(scroll_events),0) as scroll_events, COUNT(*) as count").
			Where("user_id = ? AND timestamp >= ? AND timestamp < ?", emp.ID, startOfDay, endOfDay).
			Scan(&sums)

		entry.MouseMoves = sums.MouseMoves
		entry.MouseClicks = sums.MouseClicks
		entry.Keystrokes = sums.Keystrokes
		entry.ScrollEvents = sums.ScrollEvents
		entry.TotalHeartbeats = sums.Count

		// Latest screenshot
		var ss models.Screenshot
		if err := database.DB.Where("user_id = ? AND timestamp >= ? AND timestamp < ?", emp.ID, startOfDay, endOfDay).
			Order("timestamp desc").First(&ss).Error; err == nil {
			entry.LatestScreenshot = &ss.ImageURL
		}

		// Only include employees that have agent data
		if sums.Count > 0 {
			entries = append(entries, entry)
		}
	}

	return c.JSON(http.StatusOK, entries)
}

// GetAppUsage returns app usage breakdown for a user (today).
func GetAppUsage(c echo.Context) error {
	today := todayStr()
	startOfDay, _ := time.Parse("2006-01-02", today)
	endOfDay := startOfDay.Add(24 * time.Hour)

	type AppCount struct {
		ActiveApp string
		Count     int64
	}
	var results []AppCount
	database.DB.Model(&models.AgentHeartbeat{}).
		Select("active_app, COUNT(*) as count").
		Where("timestamp >= ? AND timestamp < ? AND active_app != ''", startOfDay, endOfDay).
		Group("active_app").
		Order("count desc").
		Limit(20).
		Find(&results)

	var usage []models.AppUsageEntry
	for _, r := range results {
		usage = append(usage, models.AppUsageEntry{
			App:     r.ActiveApp,
			Minutes: float64(r.Count), // each heartbeat ≈ 1 minute
		})
	}

	return c.JSON(http.StatusOK, usage)
}
