package database

import (
	"fmt"
	"log"
	"os"

	"teampulse/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() {
	// Railway/cloud providers set DATABASE_URL; fall back to individual vars for local dev
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			getEnv("DB_HOST", "localhost"),
			getEnv("DB_PORT", "5432"),
			getEnv("DB_USER", "teampulse"),
			getEnv("DB_PASSWORD", "teampulse"),
			getEnv("DB_NAME", "teampulse"),
		)
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Database connected")
}

func Migrate() {
	err := DB.AutoMigrate(
		&models.User{},
		&models.TimeEntry{},
		&models.ActivityPing{},
		&models.Task{},
		&models.TaskTime{},
		&models.KPI{},
		&models.Standup{},
		&models.AgentSetupToken{},
		&models.AgentHeartbeat{},
		&models.ActivitySegment{},
		&models.DailyAggregation{},
		&models.AuditLog{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	log.Println("Database migrated")

	// Seed or update admin user from env vars
	adminEmail := getEnv("ADMIN_EMAIL", "admin@teampulse.local")
	adminPass := getEnv("ADMIN_PASSWORD", "admin123")
	hash, _ := bcrypt.GenerateFromPassword([]byte(adminPass), bcrypt.DefaultCost)

	var admin models.User
	result := DB.Where("role = ?", models.RoleAdmin).First(&admin)
	if result.Error != nil {
		// No admin exists — create one
		admin = models.User{
			Email:    adminEmail,
			Password: string(hash),
			Name:     "Admin",
			Role:     models.RoleAdmin,
			Title:    "Administrator",
			IsActive: true,
		}
		DB.Create(&admin)
		log.Printf("Admin user created: %s", admin.Email)
	} else if admin.Email != adminEmail {
		// Admin exists but env vars changed — update credentials
		DB.Model(&admin).Updates(map[string]interface{}{
			"email":    adminEmail,
			"password": string(hash),
		})
		log.Printf("Admin user updated to: %s", adminEmail)
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
