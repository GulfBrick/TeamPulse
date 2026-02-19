package models

import (
	"time"

	"gorm.io/gorm"
)

// ─── Users & Auth ─────────────────────────────────────────────

type Role string

const (
	RoleAdmin    Role = "admin"
	RoleEmployee Role = "employee"
)

type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Email     string         `gorm:"uniqueIndex;not null" json:"email"`
	Password  string         `gorm:"not null" json:"-"`
	Name      string         `gorm:"not null" json:"name"`
	Role      Role           `gorm:"not null;default:employee" json:"role"`
	Title     string         `json:"title"`
	PIN       string         `gorm:"size:6" json:"-"`
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ─── Time Clock ───────────────────────────────────────────────

type TimeEntry struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	UserID     uint       `gorm:"not null;index" json:"user_id"`
	User       User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ClockIn    time.Time  `gorm:"not null" json:"clock_in"`
	ClockOut   *time.Time `json:"clock_out"`
	Duration   int64      `json:"duration_seconds"` // computed on clock-out
	Notes      string     `json:"notes"`
	Date       string     `gorm:"not null;index;size:10" json:"date"` // YYYY-MM-DD for easy filtering
	CreatedAt  time.Time  `json:"created_at"`
}

// ─── Activity Tracking ────────────────────────────────────────

type ActivityPing struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"not null;index" json:"user_id"`
	TimeEntryID uint      `gorm:"index" json:"time_entry_id"`
	Timestamp   time.Time `gorm:"not null" json:"timestamp"`
	IsActive    bool      `gorm:"not null" json:"is_active"` // false = idle
	IdleSeconds int       `json:"idle_seconds"`              // how long idle before this ping
}

// ─── Tasks ────────────────────────────────────────────────────

type TaskStatus string
type TaskPriority string

const (
	TaskPending    TaskStatus = "pending"
	TaskInProgress TaskStatus = "in_progress"
	TaskComplete   TaskStatus = "complete"

	PriorityLow    TaskPriority = "low"
	PriorityMedium TaskPriority = "medium"
	PriorityHigh   TaskPriority = "high"
)

type Task struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"not null" json:"title"`
	Description string         `json:"description"`
	AssigneeID  *uint          `gorm:"index" json:"assignee_id"`
	Assignee    *User          `gorm:"foreignKey:AssigneeID" json:"assignee,omitempty"`
	CreatedByID uint           `gorm:"not null" json:"created_by_id"`
	Status      TaskStatus     `gorm:"not null;default:pending" json:"status"`
	Priority    TaskPriority   `gorm:"not null;default:medium" json:"priority"`
	DueDate     *string        `json:"due_date"` // YYYY-MM-DD
	CompletedAt *time.Time     `json:"completed_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	TaskTimes   []TaskTime     `json:"task_times,omitempty"`
}

// ─── Task Time Tracking ───────────────────────────────────────

type TaskTime struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	TaskID    uint       `gorm:"not null;index" json:"task_id"`
	UserID    uint       `gorm:"not null;index" json:"user_id"`
	User      User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	StartedAt time.Time  `gorm:"not null" json:"started_at"`
	StoppedAt *time.Time `json:"stopped_at"`
	Duration  int64      `json:"duration_seconds"`
}

// ─── KPIs ─────────────────────────────────────────────────────

type KPI struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Metric    string    `gorm:"not null" json:"metric"`
	Target    float64   `gorm:"not null" json:"target"`
	Current   float64   `gorm:"not null;default:0" json:"current"`
	Unit      string    `json:"unit"`
	Period    string    `gorm:"default:monthly" json:"period"` // weekly, monthly, quarterly
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ─── Standups ─────────────────────────────────────────────────

type Standup struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Date      string    `gorm:"not null;index;size:10" json:"date"`
	Yesterday string    `json:"yesterday"`
	Today     string    `gorm:"not null" json:"today"`
	Blockers  string    `json:"blockers"`
	CreatedAt time.Time `json:"created_at"`
}

// ─── DTOs ─────────────────────────────────────────────────────

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
	Title    string `json:"title"`
	Role     Role   `json:"role"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type ActivityPingRequest struct {
	IsActive    bool `json:"is_active"`
	IdleSeconds int  `json:"idle_seconds"`
}

type DashboardStats struct {
	TotalEmployees  int64          `json:"total_employees"`
	ClockedIn       int64          `json:"clocked_in"`
	TotalHoursToday float64        `json:"total_hours_today"`
	TasksDoneToday  int64          `json:"tasks_done_today"`
	PendingTasks    int64          `json:"pending_tasks"`
	TeamStatus      []TeamMember   `json:"team_status"`
	RecentActivity  []ActivityStat `json:"recent_activity"`
}

type TeamMember struct {
	ID            uint    `json:"id"`
	Name          string  `json:"name"`
	Title         string  `json:"title"`
	IsClockedIn   bool    `json:"is_clocked_in"`
	HoursToday    float64 `json:"hours_today"`
	ActiveMinutes int     `json:"active_minutes_today"`
	IdleMinutes   int     `json:"idle_minutes_today"`
	ActiveTask    *string `json:"active_task"`
}

type ActivityStat struct {
	UserID        uint    `json:"user_id"`
	UserName      string  `json:"user_name"`
	ActivePercent float64 `json:"active_percent"`
	TotalPings    int     `json:"total_pings"`
	ActivePings   int     `json:"active_pings"`
}
