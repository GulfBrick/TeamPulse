package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"teampulse/internal/database"
	mw "teampulse/internal/middleware"
	"teampulse/internal/models"

	"github.com/labstack/echo/v4"
)

// Sensitive keywords to strip from window titles
var sensitiveKeywords = []string{"bank", "password", "credential", "secret", "private", "payroll", "salary"}

func filterWindowTitle(title string) string {
	lower := strings.ToLower(title)
	for _, kw := range sensitiveKeywords {
		if strings.Contains(lower, kw) {
			return "[Filtered — sensitive content]"
		}
	}
	return title
}

// ─── POST /api/agent/segments — Receive batch of segments from desktop agent ───

func ReceiveSegments(c echo.Context) error {
	userID := mw.GetUserID(c)

	var segments []models.SegmentRequest
	if err := c.Bind(&segments); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if len(segments) == 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{"status": "ok", "received": 0})
	}

	// Ensure agent_setup_done is true
	database.DB.Model(&models.User{}).Where("id = ? AND agent_setup_done = false", userID).Update("agent_setup_done", true)

	affectedDates := map[string]bool{}
	saved := 0

	for _, seg := range segments {
		startTime, err := time.Parse(time.RFC3339, seg.StartTime)
		if err != nil {
			continue
		}
		endTime, err := time.Parse(time.RFC3339, seg.EndTime)
		if err != nil {
			continue
		}

		// Validate: end > start
		if !endTime.After(startTime) {
			continue
		}

		duration := int(endTime.Sub(startTime).Seconds())
		date := startTime.Local().Format("2006-01-02")

		// Privacy: filter sensitive window titles
		windowTitle := filterWindowTitle(seg.WindowTitle)

		record := models.ActivitySegment{
			UserID:       userID,
			StartTime:    startTime,
			EndTime:      endTime,
			Duration:     duration,
			SegmentType:  seg.SegmentType,
			AppName:      seg.AppName,
			WindowTitle:  windowTitle,
			MouseMoves:   seg.MouseMoves,
			MouseClicks:  seg.MouseClicks,
			Keystrokes:   seg.Keystrokes,
			ScrollEvents: seg.ScrollEvents,
			Date:         date,
		}

		if err := database.DB.Create(&record).Error; err != nil {
			continue
		}

		affectedDates[date] = true
		saved++
	}

	// Update daily aggregations for affected dates
	for date := range affectedDates {
		updateDailyAggregation(userID, date)
	}

	// Broadcast to WebSocket clients
	if saved > 0 {
		BroadcastMonitorUpdate("segments", map[string]interface{}{
			"user_id":  userID,
			"received": saved,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"status": "ok", "received": saved})
}

// updateDailyAggregation recalculates the daily aggregation for a user+date
func updateDailyAggregation(userID uint, date string) {
	type Sums struct {
		TotalActive  int
		TotalIdle    int
		MouseMoves   int
		MouseClicks  int
		Keystrokes   int
		ScrollEvents int
	}

	var activeSums Sums
	database.DB.Model(&models.ActivitySegment{}).
		Select("COALESCE(SUM(duration),0) as total_active, COALESCE(SUM(mouse_moves),0) as mouse_moves, COALESCE(SUM(mouse_clicks),0) as mouse_clicks, COALESCE(SUM(keystrokes),0) as keystrokes, COALESCE(SUM(scroll_events),0) as scroll_events").
		Where("user_id = ? AND date = ? AND segment_type = 'active'", userID, date).
		Scan(&activeSums)

	var idleSums struct{ TotalIdle int }
	database.DB.Model(&models.ActivitySegment{}).
		Select("COALESCE(SUM(duration),0) as total_idle").
		Where("user_id = ? AND date = ? AND segment_type = 'idle'", userID, date).
		Scan(&idleSums)

	// Top apps
	type AppDur struct {
		AppName  string `json:"AppName"`
		Duration int    `json:"Duration"`
	}
	var topApps []AppDur
	database.DB.Model(&models.ActivitySegment{}).
		Select("app_name, SUM(duration) as duration").
		Where("user_id = ? AND date = ? AND app_name != '' AND segment_type = 'active'", userID, date).
		Group("app_name").
		Order("duration desc").
		Limit(10).
		Find(&topApps)

	topAppsJSON, _ := json.Marshal(topApps)

	agg := models.DailyAggregation{}
	result := database.DB.Where("user_id = ? AND date = ?", userID, date).First(&agg)

	agg.UserID = userID
	agg.Date = date
	agg.TotalActiveSeconds = activeSums.TotalActive
	agg.TotalIdleSeconds = idleSums.TotalIdle
	agg.TotalMouseMoves = activeSums.MouseMoves
	agg.TotalMouseClicks = activeSums.MouseClicks
	agg.TotalKeystrokes = activeSums.Keystrokes
	agg.TotalScrollEvents = activeSums.ScrollEvents
	agg.TopApps = string(topAppsJSON)
	agg.UpdatedAt = time.Now()

	if result.Error != nil {
		database.DB.Create(&agg)
	} else {
		database.DB.Save(&agg)
	}
}

// ─── GET /api/segments?user_id=X&date=YYYY-MM-DD — Admin: get segments for timeline ───

func GetSegments(c echo.Context) error {
	role := mw.GetUserRole(c)
	if role != models.RoleAdmin {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "admin access required"})
	}

	userIDStr := c.QueryParam("user_id")
	date := c.QueryParam("date")

	if userIDStr == "" || date == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id and date are required"})
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid user_id"})
	}

	// Audit log
	adminID := mw.GetUserID(c)
	logAudit(adminID, "viewed_timeline", uint(userID), fmt.Sprintf("date=%s", date))

	var segments []models.ActivitySegment
	database.DB.Where("user_id = ? AND date = ?", userID, date).
		Order("start_time asc").
		Find(&segments)

	return c.JSON(http.StatusOK, segments)
}

// ─── GET /api/segments/me?date=YYYY-MM-DD — Employee: get own segments ───

func GetMySegments(c echo.Context) error {
	userID := mw.GetUserID(c)
	date := c.QueryParam("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	var segments []models.ActivitySegment
	database.DB.Where("user_id = ? AND date = ?", userID, date).
		Order("start_time asc").
		Find(&segments)

	return c.JSON(http.StatusOK, segments)
}

// ─── GET /api/aggregations?date=YYYY-MM-DD — Admin: get daily aggregations ───

func GetAggregations(c echo.Context) error {
	date := c.QueryParam("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	var aggregations []models.DailyAggregation
	database.DB.Preload("User").Where("date = ?", date).Find(&aggregations)

	return c.JSON(http.StatusOK, aggregations)
}

// ─── GET /api/employee/:id/timeline?date=YYYY-MM-DD — Admin: full timeline ───

func GetEmployeeTimeline(c echo.Context) error {
	role := mw.GetUserRole(c)
	if role != models.RoleAdmin {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "admin access required"})
	}

	idStr := c.Param("id")
	employeeID, err := strconv.Atoi(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid employee id"})
	}

	date := c.QueryParam("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	adminID := mw.GetUserID(c)
	logAudit(adminID, "viewed_employee_timeline", uint(employeeID), fmt.Sprintf("date=%s", date))

	var segments []models.ActivitySegment
	database.DB.Where("user_id = ? AND date = ?", employeeID, date).
		Order("start_time asc").
		Find(&segments)

	var agg models.DailyAggregation
	database.DB.Where("user_id = ? AND date = ?", employeeID, date).First(&agg)

	return c.JSON(http.StatusOK, models.TimelineResponse{
		Segments:    segments,
		Aggregation: &agg,
	})
}

// ─── Audit Logging ───────────────────────────────────────────

func logAudit(adminID uint, action string, targetID uint, details string) {
	entry := models.AuditLog{
		AdminID:  adminID,
		Action:   action,
		TargetID: targetID,
		Details:  details,
	}
	database.DB.Create(&entry)
}
