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
	logoURL := os.Getenv("APP_URL")
	if logoURL == "" {
		logoURL = "https://teampulse-production-c56d.up.railway.app"
	}
	logoURL += "/logo.png"

	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#06060e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#06060e;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#0f0f1c;border-radius:16px;overflow:hidden;border:1px solid #1a1a2e;">
          <!-- Header with logo -->
          <tr>
            <td style="padding:40px 40px 24px;text-align:center;background:linear-gradient(180deg,rgba(34,211,238,0.08),transparent);">
              <!-- Gradient accent line -->
              <div style="height:3px;background:linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6);border-radius:2px;margin-bottom:32px;"></div>
              <img src="%s" alt="TeamPulse" width="100" height="100" style="display:block;margin:0 auto 16px;" />
              <h1 style="margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;background:linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">TeamPulse</h1>
              <p style="margin:8px 0 0;color:#64748b;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Workforce Management Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:8px 40px 40px;">
              <h2 style="margin:0 0 12px;color:#e2e8f0;font-size:22px;font-weight:700;">Welcome aboard, %s!</h2>
              <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.7;">
                Your TeamPulse account is ready. Use the credentials below to sign in and start tracking your time, tasks, and goals.
              </p>
              <!-- Credentials box -->
              <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#06060e;border-radius:12px;margin-bottom:32px;border:1px solid #252540;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 14px;color:#22d3ee;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">Your Login Details</p>
                    <table cellpadding="0" cellspacing="0" style="width:100%%;">
                      <tr>
                        <td style="padding:8px 0;color:#64748b;font-size:13px;width:130px;vertical-align:top;">Email</td>
                        <td style="padding:8px 0;color:#e2e8f0;font-size:14px;font-weight:600;">%s</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#64748b;font-size:13px;vertical-align:top;border-top:1px solid #1a1a2e;">Temporary Password</td>
                        <td style="padding:8px 0;color:#e2e8f0;font-size:14px;font-weight:600;border-top:1px solid #1a1a2e;">
                          <code style="background:#141428;padding:4px 10px;border-radius:6px;font-family:monospace;color:#22d3ee;border:1px solid #252540;">%s</code>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="%s" style="display:inline-block;background:linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 48px;border-radius:12px;letter-spacing:0.3px;">
                      Sign In to TeamPulse
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#475569;font-size:13px;text-align:center;">
                We recommend changing your password after your first login.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #1a1a2e;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">&copy; 2026 TeamPulse &middot; Powered by GulfBrick</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, logoURL, name, email, password, loginURL)
}
