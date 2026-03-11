package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	mw "teampulse/internal/middleware"

	"github.com/labstack/echo/v4"
)

const uploadDir = "uploads"

func init() {
	os.MkdirAll(uploadDir, 0755)
}

// UploadFile handles multipart file uploads (images only).
// Returns the URL path to the uploaded file.
func UploadFile(c echo.Context) error {
	_ = mw.GetUserID(c) // ensure authenticated

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no file provided"})
	}

	// Validate file size (max 10MB)
	if file.Size > 10*1024*1024 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file too large (max 10MB)"})
	}

	// Validate file type (images only)
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".heic": true}
	if !allowed[ext] {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "only image files are allowed (jpg, png, gif, webp, heic)"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file"})
	}
	defer src.Close()

	// Generate unique filename
	filename := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), sanitizeFilename(strings.TrimSuffix(file.Filename, ext)), ext)
	dstPath := filepath.Join(uploadDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save file"})
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save file"})
	}

	url := "/uploads/" + filename
	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func sanitizeFilename(name string) string {
	// Keep only alphanumeric, dash, underscore
	var b strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	result := b.String()
	if len(result) > 50 {
		result = result[:50]
	}
	if result == "" {
		result = "file"
	}
	return result
}
