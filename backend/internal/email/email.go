package email

import (
	"fmt"
	"log"
	"os"

	"github.com/resend/resend-go/v2"
)

// SendWelcomeEmail sends a styled welcome email to a newly created employee.
// If RESEND_API_KEY is not set, it logs a warning and returns nil.
func SendWelcomeEmail(name, toEmail, password, loginURL string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		log.Println("WARN: RESEND_API_KEY not set, skipping welcome email")
		return nil
	}

	client := resend.NewClient(apiKey)

	html := buildWelcomeHTML(name, toEmail, password, loginURL)

	params := &resend.SendEmailRequest{
		From:    "TeamPulse <noreply@contact.clearlinemarkets.com>",
		To:      []string{toEmail},
		Subject: "Welcome to TeamPulse!",
		Html:    html,
	}

	_, err := client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send welcome email: %w", err)
	}
	return nil
}

func buildWelcomeHTML(name, email, password, loginURL string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">TeamPulse</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#f1f5f9;font-size:22px;">Welcome, %s!</h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:16px;line-height:1.6;">
                Your TeamPulse account has been created. Use the credentials below to sign in and get started.
              </p>
              <!-- Credentials box -->
              <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:8px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 12px;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your Login Details</p>
                    <p style="margin:0 0 8px;color:#e2e8f0;font-size:15px;"><strong>Email:</strong> %s</p>
                    <p style="margin:0;color:#e2e8f0;font-size:15px;"><strong>Temporary Password:</strong> %s</p>
                  </td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="%s" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 40px;border-radius:8px;">
                      Sign In
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#64748b;font-size:13px;text-align:center;">
                We recommend changing your password after your first login.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#475569;font-size:13px;">&copy; 2025 TeamPulse. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, name, email, password, loginURL)
}
