package handlers

import (
	"crypto/rand"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"teampulse/internal/database"
	mw "teampulse/internal/middleware"
	"teampulse/internal/models"

	"github.com/labstack/echo/v4"
)

// ─── Setup Token Flow ────────────────────────────────────────

func generateCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I to avoid confusion
	code := make([]byte, 6)
	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		code[i] = chars[n.Int64()]
	}
	return string(code)
}

// GenerateSetupToken creates a 6-char setup code for the current user.
// The employee sees this in the web app and pastes it into the desktop agent.
func GenerateSetupToken(c echo.Context) error {
	userID := mw.GetUserID(c)

	// Invalidate any existing unused tokens for this user
	database.DB.Model(&models.AgentSetupToken{}).
		Where("user_id = ? AND used = false", userID).
		Update("used", true)

	token := models.AgentSetupToken{
		UserID:    userID,
		Code:      generateCode(),
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	database.DB.Create(&token)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":       token.Code,
		"expires_at": token.ExpiresAt,
	})
}

// ExchangeSetupCode is a PUBLIC endpoint (no JWT required).
// The desktop agent sends the 6-char code and receives a JWT in return.
func ExchangeSetupCode(c echo.Context) error {
	var req struct {
		Code string `json:"code"`
	}
	if err := c.Bind(&req); err != nil || req.Code == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "code is required"})
	}

	var token models.AgentSetupToken
	err := database.DB.Where("code = ? AND used = false AND expires_at > ?", req.Code, time.Now()).First(&token).Error
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid or expired code"})
	}

	// Mark as used
	database.DB.Model(&token).Update("used", true)

	// Mark user as agent setup done
	database.DB.Model(&models.User{}).Where("id = ?", token.UserID).Update("agent_setup_done", true)

	// Get user and generate JWT
	var user models.User
	database.DB.First(&user, token.UserID)

	jwt, err := mw.GenerateToken(user)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
	}

	return c.JSON(http.StatusOK, models.LoginResponse{Token: jwt, User: user})
}

// GetAgentStatus checks if the current user has completed agent setup.
func GetAgentStatus(c echo.Context) error {
	userID := mw.GetUserID(c)

	var user models.User
	database.DB.First(&user, userID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"agent_setup_done": user.AgentSetupDone,
	})
}

// SkipAgentSetup allows an employee to dismiss the onboarding.
func SkipAgentSetup(c echo.Context) error {
	userID := mw.GetUserID(c)
	database.DB.Model(&models.User{}).Where("id = ?", userID).Update("agent_setup_done", true)
	return c.JSON(http.StatusOK, map[string]string{"status": "skipped"})
}

// DownloadAgent serves the pre-built .exe installer.
func DownloadAgent(c echo.Context) error {
	installerPath := "agent/TeamPulseAgent-Setup.exe"
	if _, err := os.Stat(installerPath); os.IsNotExist(err) {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Agent installer not available yet. Ask your administrator.",
		})
	}
	return c.File(installerPath)
}

// ─── Heartbeat & Screenshots ─────────────────────────────────

// RecordAgentHeartbeat receives tracking data from the desktop agent.
func RecordAgentHeartbeat(c echo.Context) error {
	userID := mw.GetUserID(c)

	var req models.AgentHeartbeatRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	// Ensure agent_setup_done is true on first heartbeat
	database.DB.Model(&models.User{}).Where("id = ? AND agent_setup_done = false", userID).Update("agent_setup_done", true)

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

// ─── Admin Endpoints ─────────────────────────────────────────

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

		var latest models.AgentHeartbeat
		if err := database.DB.Where("user_id = ? AND timestamp >= ? AND timestamp < ?", emp.ID, startOfDay, endOfDay).
			Order("timestamp desc").First(&latest).Error; err == nil {
			entry.ActiveApp = latest.ActiveApp
			entry.ActiveWindowTitle = latest.ActiveWindowTitle
		}

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

		var ss models.Screenshot
		if err := database.DB.Where("user_id = ? AND timestamp >= ? AND timestamp < ?", emp.ID, startOfDay, endOfDay).
			Order("timestamp desc").First(&ss).Error; err == nil {
			entry.LatestScreenshot = &ss.ImageURL
		}

		if sums.Count > 0 {
			entries = append(entries, entry)
		}
	}

	return c.JSON(http.StatusOK, entries)
}

// GetAppUsage returns app usage breakdown for today.
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
			Minutes: float64(r.Count),
		})
	}

	return c.JSON(http.StatusOK, usage)
}
