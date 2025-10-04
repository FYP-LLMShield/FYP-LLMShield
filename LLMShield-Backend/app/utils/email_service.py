import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_server = "smtp.gmail.com"  # You can change this
        self.smtp_port = 587
        # For testing, we'll just print emails to console
        # In production, you'd use real email credentials
        
    async def send_verification_email(self, email: str, verification_token: str, name: str):
        """Send email verification email"""
        try:
            subject = "Verify Your LLMShield Account"
            verification_link = f"http://localhost:8000/api/v1/auth/verify-email/{verification_token}"
            
            html_body = f"""
            <html>
                <body>
                    <h2>Welcome to LLMShield, {name}!</h2>
                    <p>Thank you for registering. Please click the link below to verify your email address:</p>
                    <p><a href="{verification_link}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
                    <p>Or copy and paste this link in your browser:</p>
                    <p>{verification_link}</p>
                    <p>This link will expire in 24 hours.</p>
                    <br>
                    <p>If you didn't create this account, please ignore this email.</p>
                    <p>Best regards,<br>LLMShield Team</p>
                </body>
            </html>
            """
            
            # For development, we'll just print the email content
            print("\n" + "="*50)
            print("📧 VERIFICATION EMAIL")
            print("="*50)
            print(f"To: {email}")
            print(f"Subject: {subject}")
            print(f"Verification Link: {verification_link}")
            print("="*50 + "\n")
            
            # In production, uncomment this to send real emails:
            # await self._send_email(email, subject, html_body)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send verification email: {e}")
            return False
    
    async def send_password_reset_email(self, email: str, reset_token: str, name: str):
        """Send password reset email"""
        try:
            subject = "Reset Your LLMShield Password"
            reset_link = f"http://localhost:3000/reset-password?token={reset_token}"  # Your frontend URL
            
            html_body = f"""
            <html>
                <body>
                    <h2>Password Reset Request</h2>
                    <p>Hello {name},</p>
                    <p>You requested to reset your password. Click the link below to reset it:</p>
                    <p><a href="{reset_link}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
                    <p>Or copy and paste this link in your browser:</p>
                    <p>{reset_link}</p>
                    <p>This link will expire in 1 hour.</p>
                    <br>
                    <p>If you didn't request this, please ignore this email.</p>
                    <p>Best regards,<br>LLMShield Team</p>
                </body>
            </html>
            """
            
            # For development, we'll just print the email content
            print("\n" + "="*50)
            print("📧 PASSWORD RESET EMAIL")
            print("="*50)
            print(f"To: {email}")
            print(f"Subject: {subject}")
            print(f"Reset Link: {reset_link}")
            print("="*50 + "\n")
            
            # In production, uncomment this to send real emails:
            # await self._send_email(email, subject, html_body)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send reset email: {e}")
            return False
    
    async def _send_email(self, to_email: str, subject: str, html_body: str):
        """Send actual email (for production)"""
        try:
            # This would be used in production with real SMTP credentials
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = "noreply@llmshield.com"
            msg['To'] = to_email
            
            msg.attach(MIMEText(html_body, 'html'))
            
            # Connect to server and send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            # server.login(settings.EMAIL_USERNAME, settings.EMAIL_PASSWORD)
            server.send_message(msg)
            server.quit()
            
            return True
        except Exception as e:
            logger.error(f"SMTP Error: {e}")
            return False

# Create single instance
email_service = EmailService()