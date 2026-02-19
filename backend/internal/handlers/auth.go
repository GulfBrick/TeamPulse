package handlers

import (
	"net/http"
	"regexp"

	"teampulse/internal/database"
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

	user := models.User{
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
	database.DB.Model(&models.User{}).Where("id = ?", id).Update("is_active", false)
	return c.JSON(http.StatusOK, map[string]string{"status": "deactivated"})
}
