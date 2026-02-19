package handlers

import (
	"net/http"
	"time"

	"teampulse/internal/database"
	mw "teampulse/internal/middleware"
	"teampulse/internal/models"

	"github.com/labstack/echo/v4"
)

// ─── Tasks ────────────────────────────────────────────────────

func CreateTask(c echo.Context) error {
	var task models.Task
	if err := c.Bind(&task); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	task.CreatedByID = mw.GetUserID(c)
	if task.Status == "" {
		task.Status = models.TaskPending
	}
	if task.Priority == "" {
		task.Priority = models.PriorityMedium
	}

	database.DB.Create(&task)
	database.DB.Preload("Assignee").First(&task, task.ID)
	return c.JSON(http.StatusCreated, task)
}

func ListTasks(c echo.Context) error {
	userID := mw.GetUserID(c)
	role := mw.GetUserRole(c)
	status := c.QueryParam("status")

	var tasks []models.Task
	q := database.DB.Preload("Assignee").Preload("TaskTimes").Order("created_at desc")

	if role != models.RoleAdmin {
		q = q.Where("assignee_id = ?", userID)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}

	q.Find(&tasks)
	return c.JSON(http.StatusOK, tasks)
}

func UpdateTask(c echo.Context) error {
	id := c.Param("id")
	var task models.Task
	if err := database.DB.First(&task, id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "task not found"})
	}

	var updates map[string]interface{}
	if err := c.Bind(&updates); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	// Handle status transitions
	if newStatus, ok := updates["status"]; ok {
		if newStatus == "complete" {
			now := time.Now()
			updates["completed_at"] = &now
		} else {
			updates["completed_at"] = nil
		}
	}

	delete(updates, "id")
	database.DB.Model(&task).Updates(updates)
	database.DB.Preload("Assignee").First(&task, id)
	return c.JSON(http.StatusOK, task)
}

func DeleteTask(c echo.Context) error {
	id := c.Param("id")
	database.DB.Delete(&models.Task{}, id)
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}

// ─── KPIs ─────────────────────────────────────────────────────

func CreateKPI(c echo.Context) error {
	var kpi models.KPI
	if err := c.Bind(&kpi); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	database.DB.Create(&kpi)
	database.DB.Preload("User").First(&kpi, kpi.ID)
	return c.JSON(http.StatusCreated, kpi)
}

func ListKPIs(c echo.Context) error {
	userID := mw.GetUserID(c)
	role := mw.GetUserRole(c)

	var kpis []models.KPI
	q := database.DB.Preload("User").Order("created_at desc")

	if role != models.RoleAdmin {
		q = q.Where("user_id = ?", userID)
	}

	q.Find(&kpis)
	return c.JSON(http.StatusOK, kpis)
}

func UpdateKPI(c echo.Context) error {
	id := c.Param("id")
	var kpi models.KPI
	if err := database.DB.First(&kpi, id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "KPI not found"})
	}

	var updates map[string]interface{}
	if err := c.Bind(&updates); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	delete(updates, "id")
	database.DB.Model(&kpi).Updates(updates)
	database.DB.Preload("User").First(&kpi, id)
	return c.JSON(http.StatusOK, kpi)
}

func DeleteKPI(c echo.Context) error {
	id := c.Param("id")
	database.DB.Delete(&models.KPI{}, id)
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}

// ─── Standups ─────────────────────────────────────────────────

func CreateStandup(c echo.Context) error {
	var standup models.Standup
	if err := c.Bind(&standup); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	standup.UserID = mw.GetUserID(c)
	if standup.Date == "" {
		standup.Date = todayStr()
	}

	database.DB.Create(&standup)
	database.DB.Preload("User").First(&standup, standup.ID)
	return c.JSON(http.StatusCreated, standup)
}

func ListStandups(c echo.Context) error {
	userID := mw.GetUserID(c)
	role := mw.GetUserRole(c)
	date := c.QueryParam("date")

	var standups []models.Standup
	q := database.DB.Preload("User").Order("created_at desc")

	if role != models.RoleAdmin {
		q = q.Where("user_id = ?", userID)
	}
	if date != "" {
		q = q.Where("date = ?", date)
	} else {
		q = q.Limit(30)
	}

	q.Find(&standups)
	return c.JSON(http.StatusOK, standups)
}

func DeleteStandup(c echo.Context) error {
	id := c.Param("id")
	database.DB.Delete(&models.Standup{}, id)
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}
