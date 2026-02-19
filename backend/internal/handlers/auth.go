package handlers

import (
	"log"
	"net/http"
	"os"
	"regexp"

	"teampulse/internal/database"
	"teampulse/internal/email"
	mw "teampulse/internal/middleware"
	"teampulse/internal/models"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func Login(c echo.Context) error {
	var req models.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	if !emailRegex.MatchString(req.Email) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid email format"})
	}

	var user models.User
	if err := database.DB.Where("email = ? AND is_active = true", req.Email).First(&user).Error; err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
	}

	token, err := mw.GenerateToken(user)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
	}

	return c.JSON(http.StatusOK, models.LoginResponse{Token: token, User: user})
}

// RegisterEmployee - admin creates employee accounts
func RegisterEmployee(c echo.Context) error {
	var req models.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	if req.Email == "" || req.Password == "" || req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "email, password, and name are required"})
	}

	if !emailRegex.MatchString(req.Email) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid email format"})
	}

	if len(req.Password) < 8 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "password must be at least 8 characters"})
	}

	if len(req.Name) > 200 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name must be 200 characters or fewer"})
	}

	// Only admin can create accounts
	if req.Role == "" {
		req.Role = models.RoleEmployee
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
	}

	// Check if a deactivated user with this email already exists
	var user models.User
	if err := database.DB.Where("email = ?", req.Email).First(&user).Error; err == nil {
		if user.IsActive {
			return c.JSON(http.StatusConflict, map[string]string{"error": "email already exists"})
		}
		// Reactivate the deactivated user with new details
		user.Password = string(hash)
		user.Name = req.Name
		user.Title = req.Title
		user.Role = req.Role
		user.IsActive = true
		database.DB.Save(&user)
	} else {
		user = models.User{
			Email:    req.Email,
			Password: string(hash),
			Name:     req.Name,
			Title:    req.Title,
			Role:     req.Role,
			IsActive: true,
		}
		if err := database.DB.Create(&user).Error; err != nil {
			return c.JSON(http.StatusConflict, map[string]string{"error": "email already exists"})
		}
	}

	// Send welcome email in background (don't block the response)
	plainPassword := req.Password
	loginURL := os.Getenv("APP_URL")
	if loginURL == "" {
		loginURL = "https://teampulse-production-c56d.up.railway.app"
	}
	go func() {
		if err := email.SendWelcomeEmail(req.Name, req.Email, plainPassword, loginURL); err != nil {
			log.Printf("ERROR: welcome email to %s failed: %v", req.Email, err)
		} else {
			log.Printf("INFO: welcome email sent to %s", req.Email)
		}
	}()

	user.Password = "" // strip from response
	return c.JSON(http.StatusCreated, user)
}

func GetMe(c echo.Context) error {
	userID := mw.GetUserID(c)
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "user not found"})
	}
	return c.JSON(http.StatusOK, user)
}

func ListEmployees(c echo.Context) error {
	var users []models.User
	database.DB.Where("is_active = true").Order("name asc").Find(&users)
	return c.JSON(http.StatusOK, users)
}

func UpdateEmployee(c echo.Context) error {
	id := c.Param("id")
	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "user not found"})
	}

	var updates map[string]interface{}
	if err := c.Bind(&updates); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	// Don't allow password update through this endpoint
	delete(updates, "password")
	delete(updates, "id")

	database.DB.Model(&user).Updates(updates)
	database.DB.First(&user, id)
	return c.JSON(http.StatusOK, user)
}

func DeactivateEmployee(c echo.Context) error {
	id := c.Param("id")

	// Check if hard delete requested
	if c.QueryParam("hard") == "true" {
		// Delete all related data first
		database.DB.Where("user_id = ?", id).Delete(&models.TimeEntry{})
		database.DB.Where("user_id = ?", id).Delete(&models.ActivityPing{})
		database.DB.Where("user_id = ?", id).Delete(&models.TaskTime{})
		database.DB.Where("user_id = ?", id).Delete(&models.KPI{})
		database.DB.Where("user_id = ?", id).Delete(&models.Standup{})
		database.DB.Where("user_id = ?", id).Delete(&models.AgentSetupToken{})
		database.DB.Where("user_id = ?", id).Delete(&models.AgentHeartbeat{})
		database.DB.Where("user_id = ?", id).Delete(&models.Screenshot{})
		database.DB.Unscoped().Where("id = ?", id).Delete(&models.User{})
		return c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
	}

	database.DB.Model(&models.User{}).Where("id = ?", id).Update("is_active", false)
	return c.JSON(http.StatusOK, map[string]string{"status": "deactivated"})
}
