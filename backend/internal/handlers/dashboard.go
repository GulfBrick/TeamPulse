package handlers

import (
	"net/http"
	"strconv"
	"time"

	"teampulse/internal/database"
	mw "teampulse/internal/middleware"
	"teampulse/internal/models"

	"github.com/labstack/echo/v4"
)

func GetDashboard(c echo.Context) error {
	today := todayStr()

	var stats models.DashboardStats

	// Total active employees
	database.DB.Model(&models.User{}).Where("is_active = true AND role = ?", models.RoleEmployee).Count(&stats.TotalEmployees)

	// Currently clocked in
	database.DB.Model(&models.TimeEntry{}).
		Joins("JOIN users ON users.id = time_entries.user_id").
		Where("time_entries.clock_out IS NULL AND users.is_active = true").
		Count(&stats.ClockedIn)

	// Total hours today
	var entries []models.TimeEntry
	database.DB.Where("date = ? AND clock_out IS NOT NULL", today).Find(&entries)
	for _, e := range entries {
		stats.TotalHoursToday += float64(e.Duration) / 3600.0
	}
	// Add ongoing sessions
	var activeEntries []models.TimeEntry
	database.DB.Where("date = ? AND clock_out IS NULL", today).Find(&activeEntries)
	for _, e := range activeEntries {
		stats.TotalHoursToday += time.Since(e.ClockIn).Hours()
	}

	// Tasks completed today
	database.DB.Model(&models.Task{}).
		Where("status = ? AND DATE(completed_at) = ?", models.TaskComplete, today).
		Count(&stats.TasksDoneToday)

	// Pending tasks
	database.DB.Model(&models.Task{}).
		Where("status != ?", models.TaskComplete).
		Count(&stats.PendingTasks)

	// Team status
	var employees []models.User
	database.DB.Where("is_active = true AND role = ?", models.RoleEmployee).Find(&employees)

	for _, emp := range employees {
		member := models.TeamMember{
			ID:    emp.ID,
			Name:  emp.Name,
			Title: emp.Title,
		}

		// Check clock status
		var clockEntry models.TimeEntry
		if err := database.DB.Where("user_id = ? AND clock_out IS NULL", emp.ID).First(&clockEntry).Error; err == nil {
			member.IsClockedIn = true
		}

		// Hours today
		var dayEntries []models.TimeEntry
		database.DB.Where("user_id = ? AND date = ? AND clock_out IS NOT NULL", emp.ID, today).Find(&dayEntries)
		for _, e := range dayEntries {
			member.HoursToday += float64(e.Duration) / 3600.0
		}
		if member.IsClockedIn {
			member.HoursToday += time.Since(clockEntry.ClockIn).Hours()
		}

		// Activity today
		var activePings, totalPings int64
		database.DB.Model(&models.ActivityPing{}).
			Joins("JOIN time_entries ON time_entries.id = activity_pings.time_entry_id").
			Where("time_entries.user_id = ? AND time_entries.date = ?", emp.ID, today).
			Count(&totalPings)
		database.DB.Model(&models.ActivityPing{}).
			Joins("JOIN time_entries ON time_entries.id = activity_pings.time_entry_id").
			Where("time_entries.user_id = ? AND time_entries.date = ? AND activity_pings.is_active = true", emp.ID, today).
			Count(&activePings)

		member.ActiveMinutes = int(activePings) // each ping ≈ 1 minute
		member.IdleMinutes = int(totalPings) - member.ActiveMinutes

		// Active task
		var activeTimer models.TaskTime
		if err := database.DB.Where("user_id = ? AND stopped_at IS NULL", emp.ID).First(&activeTimer).Error; err == nil {
			var task models.Task
			if err := database.DB.First(&task, activeTimer.TaskID).Error; err == nil {
				member.ActiveTask = &task.Title
			}
		}

		stats.TeamStatus = append(stats.TeamStatus, member)
	}

	return c.JSON(http.StatusOK, stats)
}

// ─── Daily Hours Chart ────────────────────────────────────────

type DailyHoursEntry struct {
	Date    string  `json:"date"`
	Hours   float64 `json:"hours"`
	Entries int     `json:"entries"`
}

func GetDailyHours(c echo.Context) error {
	days := 7
	if d := c.QueryParam("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 && parsed <= 90 {
			days = parsed
		}
	}

	userID := mw.GetUserID(c)
	role := mw.GetUserRole(c)

	result := make([]DailyHoursEntry, days)
	now := time.Now()

	for i := 0; i < days; i++ {
		day := now.AddDate(0, 0, -(days-1-i))
		dateStr := day.Format("2006-01-02")

		var entries []models.TimeEntry
		query := database.DB.Where("date = ?", dateStr)
		if role != models.RoleAdmin {
			query = query.Where("user_id = ?", userID)
		}
		query.Find(&entries)

		var totalSeconds float64
		entryCount := 0
		for _, e := range entries {
			if e.ClockOut != nil {
				totalSeconds += float64(e.Duration)
				entryCount++
			} else {
				// Active session: compute elapsed
				totalSeconds += time.Since(e.ClockIn).Seconds()
				entryCount++
			}
		}

		result[i] = DailyHoursEntry{
			Date:    dateStr,
			Hours:   totalSeconds / 3600.0,
			Entries: entryCount,
		}
	}

	return c.JSON(http.StatusOK, result)
}
