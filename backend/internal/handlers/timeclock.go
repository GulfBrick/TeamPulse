package handlers

import (
	"net/http"
	"time"

	"teampulse/internal/database"
	mw "teampulse/internal/middleware"
	"teampulse/internal/models"

	"github.com/labstack/echo/v4"
)

func todayStr() string {
	return time.Now().Format("2006-01-02")
}

// ─── Clock In/Out ─────────────────────────────────────────────

func ClockIn(c echo.Context) error {
	userID := mw.GetUserID(c)

	// Check if already clocked in
	var existing models.TimeEntry
	result := database.DB.Where("user_id = ? AND clock_out IS NULL", userID).First(&existing)
	if result.Error == nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "already clocked in"})
	}

	entry := models.TimeEntry{
		UserID:  userID,
		ClockIn: time.Now(),
		Date:    todayStr(),
	}
	database.DB.Create(&entry)

	return c.JSON(http.StatusOK, entry)
}

func ClockOut(c echo.Context) error {
	userID := mw.GetUserID(c)

	var entry models.TimeEntry
	result := database.DB.Where("user_id = ? AND clock_out IS NULL", userID).First(&entry)
	if result.Error != nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "not clocked in"})
	}

	now := time.Now()
	duration := int64(now.Sub(entry.ClockIn).Seconds())
	entry.ClockOut = &now
	entry.Duration = duration
	database.DB.Save(&entry)

	// Also stop any running task timers
	database.DB.Model(&models.TaskTime{}).
		Where("user_id = ? AND stopped_at IS NULL", userID).
		Updates(map[string]interface{}{
			"stopped_at":       now,
			"duration_seconds": 0, // will recalculate
		})

	return c.JSON(http.StatusOK, entry)
}

func GetClockStatus(c echo.Context) error {
	userID := mw.GetUserID(c)

	var entry models.TimeEntry
	result := database.DB.Where("user_id = ? AND clock_out IS NULL", userID).First(&entry)

	status := map[string]interface{}{
		"clocked_in": result.Error == nil,
	}
	if result.Error == nil {
		status["entry"] = entry
		status["elapsed_seconds"] = int64(time.Since(entry.ClockIn).Seconds())
	}

	return c.JSON(http.StatusOK, status)
}

func GetTimeEntries(c echo.Context) error {
	userID := mw.GetUserID(c)
	role := mw.GetUserRole(c)
	date := c.QueryParam("date")

	var entries []models.TimeEntry
	q := database.DB.Preload("User").Order("clock_in desc")

	// Employees see only their own, admins see all
	if role != models.RoleAdmin {
		q = q.Where("user_id = ?", userID)
	}

	if date != "" {
		q = q.Where("date = ?", date)
	} else {
		q = q.Limit(50)
	}

	q.Find(&entries)
	return c.JSON(http.StatusOK, entries)
}

// ─── Activity Pings ───────────────────────────────────────────
// The frontend sends a ping every 60 seconds while the employee is clocked in.
// is_active=true means keyboard/mouse activity detected in the last interval.

func RecordActivityPing(c echo.Context) error {
	userID := mw.GetUserID(c)

	var req models.ActivityPingRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	// Get current time entry
	var entry models.TimeEntry
	result := database.DB.Where("user_id = ? AND clock_out IS NULL", userID).First(&entry)
	if result.Error != nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "not clocked in"})
	}

	ping := models.ActivityPing{
		UserID:      userID,
		TimeEntryID: entry.ID,
		Timestamp:   time.Now(),
		IsActive:    req.IsActive,
		IdleSeconds: req.IdleSeconds,
	}
	database.DB.Create(&ping)

	return c.JSON(http.StatusOK, map[string]string{"status": "recorded"})
}

// GetActivityStats - admin endpoint to view activity percentages
func GetActivityStats(c echo.Context) error {
	date := c.QueryParam("date")
	if date == "" {
		date = todayStr()
	}

	// Get all time entries for the date
	var entries []models.TimeEntry
	database.DB.Preload("User").Where("date = ?", date).Find(&entries)

	var stats []models.ActivityStat
	for _, entry := range entries {
		var totalPings, activePings int64
		database.DB.Model(&models.ActivityPing{}).Where("time_entry_id = ?", entry.ID).Count(&totalPings)
		database.DB.Model(&models.ActivityPing{}).Where("time_entry_id = ? AND is_active = true", entry.ID).Count(&activePings)

		pct := float64(0)
		if totalPings > 0 {
			pct = float64(activePings) / float64(totalPings) * 100
		}

		stats = append(stats, models.ActivityStat{
			UserID:        entry.UserID,
			UserName:      entry.User.Name,
			ActivePercent: pct,
			TotalPings:    int(totalPings),
			ActivePings:   int(activePings),
		})
	}

	return c.JSON(http.StatusOK, stats)
}

// ─── Task Time Tracking ───────────────────────────────────────

func StartTaskTimer(c echo.Context) error {
	userID := mw.GetUserID(c)
	taskID := c.Param("id")

	// Stop any other running timer for this user
	now := time.Now()
	database.DB.Model(&models.TaskTime{}).
		Where("user_id = ? AND stopped_at IS NULL", userID).
		Updates(map[string]interface{}{
			"stopped_at": now,
		})
	// Recalculate durations for stopped timers
	var stopped []models.TaskTime
	database.DB.Where("user_id = ? AND stopped_at IS NOT NULL AND duration_seconds = 0", userID).Find(&stopped)
	for _, s := range stopped {
		if s.StoppedAt != nil {
			dur := int64(s.StoppedAt.Sub(s.StartedAt).Seconds())
			database.DB.Model(&s).Update("duration_seconds", dur)
		}
	}

	tt := models.TaskTime{
		UserID:    userID,
		StartedAt: now,
	}
	// Parse task ID
	database.DB.Raw("SELECT ?::integer", taskID).Scan(&tt.TaskID)

	database.DB.Create(&tt)
	return c.JSON(http.StatusOK, tt)
}

func StopTaskTimer(c echo.Context) error {
	userID := mw.GetUserID(c)

	now := time.Now()
	var tt models.TaskTime
	result := database.DB.Where("user_id = ? AND stopped_at IS NULL", userID).First(&tt)
	if result.Error != nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "no active timer"})
	}

	tt.StoppedAt = &now
	tt.Duration = int64(now.Sub(tt.StartedAt).Seconds())
	database.DB.Save(&tt)

	return c.JSON(http.StatusOK, tt)
}

func GetActiveTimer(c echo.Context) error {
	userID := mw.GetUserID(c)

	var tt models.TaskTime
	result := database.DB.Preload("User").Where("user_id = ? AND stopped_at IS NULL", userID).First(&tt)

	if result.Error != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"active": false})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"active":          true,
		"task_time":       tt,
		"elapsed_seconds": int64(time.Since(tt.StartedAt).Seconds()),
	})
}
