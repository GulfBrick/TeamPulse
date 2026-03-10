package handlers

import (
	"math"
	"net/http"
	"time"

	"teampulse/internal/database"
	mw "teampulse/internal/middleware"
	"teampulse/internal/models"

	"github.com/labstack/echo/v4"
)

// ─── Leave Balance ──────────────────────────────────────────

// GetLeaveBalance returns the leave balance for the current user.
// Accrual: 1.5 days per 30 days worked (based on distinct dates with time entries).
func GetLeaveBalance(c echo.Context) error {
	userID := mw.GetUserID(c)
	return c.JSON(http.StatusOK, calculateLeaveBalance(userID))
}

// AdminGetLeaveBalance returns the leave balance for a specific employee.
func AdminGetLeaveBalance(c echo.Context) error {
	id := c.Param("id")
	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "employee not found"})
	}
	return c.JSON(http.StatusOK, calculateLeaveBalance(user.ID))
}

func calculateLeaveBalance(userID uint) models.LeaveBalanceResponse {
	// Count distinct working days from time entries
	var totalDaysWorked int64
	database.DB.Model(&models.TimeEntry{}).
		Where("user_id = ? AND clock_out IS NOT NULL", userID).
		Distinct("date").
		Count(&totalDaysWorked)

	// 1.5 days per 30 days worked
	accrued := math.Floor(float64(totalDaysWorked)/30.0*1.5*100) / 100

	// Used days: sum of approved leave days
	var usedDays float64
	database.DB.Model(&models.LeaveRequest{}).
		Select("COALESCE(SUM(days), 0)").
		Where("user_id = ? AND status = ?", userID, models.LeaveApproved).
		Scan(&usedDays)

	// Pending days
	var pendingDays float64
	database.DB.Model(&models.LeaveRequest{}).
		Select("COALESCE(SUM(days), 0)").
		Where("user_id = ? AND status = ?", userID, models.LeavePending).
		Scan(&pendingDays)

	available := accrued - usedDays
	if available < 0 {
		available = 0
	}

	return models.LeaveBalanceResponse{
		TotalDaysWorked: int(totalDaysWorked),
		AccruedDays:     accrued,
		UsedDays:        usedDays,
		AvailableDays:   available,
		PendingDays:     pendingDays,
	}
}

// ─── Apply for Leave ────────────────────────────────────────

func ApplyLeave(c echo.Context) error {
	userID := mw.GetUserID(c)

	var req models.LeaveRequestDTO
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	if req.StartDate == "" || req.EndDate == "" || req.Days <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "start_date, end_date, and days are required"})
	}

	leaveType := models.LeaveType(req.LeaveType)
	if leaveType != models.LeaveAnnual && leaveType != models.LeaveSick {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "leave_type must be 'annual' or 'sick'"})
	}

	// For sick leave, sick_note is recommended but not required at submission time
	// (they may need to submit it later)

	// Check balance for annual leave
	if leaveType == models.LeaveAnnual {
		balance := calculateLeaveBalance(userID)
		if req.Days > balance.AvailableDays {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "insufficient leave balance"})
		}
	}

	leave := models.LeaveRequest{
		UserID:    userID,
		LeaveType: leaveType,
		StartDate: req.StartDate,
		EndDate:   req.EndDate,
		Days:      req.Days,
		Reason:    req.Reason,
		SickNote:  req.SickNote,
		Status:    models.LeavePending,
	}
	database.DB.Create(&leave)
	database.DB.Preload("User").First(&leave, leave.ID)

	return c.JSON(http.StatusCreated, leave)
}

// ─── List Leave Requests ────────────────────────────────────

// ListMyLeave returns leave requests for the current user.
func ListMyLeave(c echo.Context) error {
	userID := mw.GetUserID(c)

	var leaves []models.LeaveRequest
	database.DB.Where("user_id = ?", userID).Order("created_at desc").Find(&leaves)

	return c.JSON(http.StatusOK, leaves)
}

// ListAllLeave returns all leave requests (admin).
func ListAllLeave(c echo.Context) error {
	status := c.QueryParam("status")

	q := database.DB.Preload("User").Order("created_at desc")
	if status != "" {
		q = q.Where("status = ?", status)
	}

	var leaves []models.LeaveRequest
	q.Find(&leaves)

	return c.JSON(http.StatusOK, leaves)
}

// ─── Review Leave (Admin) ───────────────────────────────────

func ReviewLeave(c echo.Context) error {
	id := c.Param("id")
	adminID := mw.GetUserID(c)

	var leave models.LeaveRequest
	if err := database.DB.First(&leave, id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "leave request not found"})
	}

	if leave.Status != models.LeavePending {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "can only review pending requests"})
	}

	var req models.LeaveReviewDTO
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	newStatus := models.LeaveStatus(req.Status)
	if newStatus != models.LeaveApproved && newStatus != models.LeaveRejected {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "status must be 'approved' or 'rejected'"})
	}

	// For annual leave approval, verify balance
	if newStatus == models.LeaveApproved && leave.LeaveType == models.LeaveAnnual {
		balance := calculateLeaveBalance(leave.UserID)
		if leave.Days > balance.AvailableDays {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "employee has insufficient leave balance"})
		}
	}

	now := time.Now()
	database.DB.Model(&leave).Updates(map[string]interface{}{
		"status":       newStatus,
		"reviewed_by":  adminID,
		"reviewed_at":  &now,
		"review_notes": req.ReviewNotes,
	})

	database.DB.Preload("User").First(&leave, id)
	return c.JSON(http.StatusOK, leave)
}

// ─── Delete/Cancel Leave ────────────────────────────────────

func CancelLeave(c echo.Context) error {
	userID := mw.GetUserID(c)
	id := c.Param("id")

	var leave models.LeaveRequest
	if err := database.DB.First(&leave, id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "leave request not found"})
	}

	// Users can only cancel their own pending requests
	if leave.UserID != userID {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "not your leave request"})
	}
	if leave.Status != models.LeavePending {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "can only cancel pending requests"})
	}

	database.DB.Delete(&leave)
	return c.JSON(http.StatusOK, map[string]string{"status": "cancelled"})
}
