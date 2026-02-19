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
<body style="margin:0;padding:0;background-color:#06060e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#06060e;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#0f0f1c;border-radius:16px;overflow:hidden;border:1px solid #1a1a2e;">
          <!-- Header with HTML logo -->
          <tr>
            <td style="padding:40px 40px 24px;text-align:center;">
              <!-- Gradient accent line top -->
              <table width="100%%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="height:3px;background:#22d3ee;border-radius:2px 0 0 2px;width:33%%;"></td>
                  <td style="height:3px;background:#3b82f6;width:34%%;"></td>
                  <td style="height:3px;background:#8b5cf6;border-radius:0 2px 2px 0;width:33%%;"></td>
                </tr>
              </table>
              <!-- Logo mark: rounded square with T + pulse -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
                <tr>
                  <td align="center">
                    <div style="width:88px;height:88px;border-radius:20px;background:#0a0a18;border:2px solid #22d3ee;display:inline-block;position:relative;text-align:center;line-height:88px;box-shadow:0 0 30px rgba(34,211,238,0.15),0 0 60px rgba(139,92,246,0.08);">
                      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" style="width:88px;height:88px;" arcsize="23%%" fillcolor="#0a0a18" strokecolor="#22d3ee" strokeweight="2px"><v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0"><center><![endif]-->
                      <table cellpadding="0" cellspacing="0" width="88" style="margin:0 auto;">
                        <!-- T top bar -->
                        <tr>
                          <td style="padding:16px 16px 0;text-align:center;">
                            <div style="height:6px;background:#22d3ee;border-radius:3px;"></div>
                          </td>
                        </tr>
                        <!-- T stem top -->
                        <tr>
                          <td align="center" style="padding:0;">
                            <div style="width:6px;height:14px;background:#3b82f6;border-radius:2px;margin:0 auto;"></div>
                          </td>
                        </tr>
                        <!-- Pulse line -->
                        <tr>
                          <td style="padding:2px 8px;text-align:center;">
                            <table cellpadding="0" cellspacing="0" width="100%%" style="border-collapse:collapse;">
                              <tr>
                                <td style="width:18%%;height:3px;background:#22d3ee;"></td>
                                <td style="width:10%%;height:3px;background:#22d3ee;transform:rotate(-40deg);"></td>
                                <td style="width:10%%;height:3px;background:#3b82f6;transform:rotate(50deg);"></td>
                                <td style="width:10%%;height:3px;background:#3b82f6;transform:rotate(-50deg);"></td>
                                <td style="width:10%%;height:3px;background:#8b5cf6;transform:rotate(40deg);"></td>
                                <td style="width:10%%;height:3px;background:#8b5cf6;transform:rotate(-30deg);"></td>
                                <td style="width:14%%;height:3px;background:#8b5cf6;"></td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <!-- T stem bottom -->
                        <tr>
                          <td align="center" style="padding:0 0 16px;">
                            <div style="width:6px;height:12px;background:#8b5cf6;border-radius:2px;margin:0 auto;"></div>
                          </td>
                        </tr>
                      </table>
                      <!--[if mso]></center></v:textbox></v:roundrect><![endif]-->
                    </div>
                  </td>
                </tr>
              </table>
              <!-- Brand name -->
              <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#22d3ee;">Team<span style="color:#8b5cf6;">Pulse</span></h1>
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
</html>`, name, email, password, loginURL)
}
