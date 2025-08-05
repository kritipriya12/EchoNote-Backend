import nodemailer from 'nodemailer';
import { db } from '../lib/db';
import { EmailDeliveryType, EmailStatus } from '@prisma/client';

// Email configuration
const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

// Verify email configuration
export const verifyEmailConfig = async (): Promise<boolean> => {
    try {
        await transporter.verify();
        console.log('Email configuration verified successfully');
        return true;
    } catch (error) {
        console.error('Email configuration verification failed:', error);
        return false;
    }
};

// Email template for letter delivery
export const createLetterEmailTemplate = (
    recipientName: string,
    letterTitle: string,
    letterContent: string,
    deliveryType: EmailDeliveryType,
    reminderNumber?: number
): { subject: string; html: string; text: string } => {
    const isReminder = deliveryType === 'REMINDER';
    const reminderText = isReminder && reminderNumber ? ` (Reminder ${reminderNumber})` : '';

    const subject = `${isReminder ? '🔔 Reminder: ' : '💌 '}Your EchoNote Letter: ${letterTitle}${reminderText}`;

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f8f9fa;
                }
                .email-container {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px 20px;
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 300;
                }
                .content {
                    padding: 30px;
                }
                .letter-title {
                    font-size: 24px;
                    color: #667eea;
                    margin-bottom: 20px;
                    text-align: center;
                    border-bottom: 2px solid #f0f0f0;
                    padding-bottom: 15px;
                }
                .letter-content {
                    background: #f8f9fa;
                    padding: 25px;
                    border-radius: 8px;
                    border-left: 4px solid #667eea;
                    margin: 20px 0;
                    font-size: 16px;
                    line-height: 1.8;
                }
                .reminder-badge {
                    background: #ff6b6b;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: bold;
                    display: inline-block;
                    margin-bottom: 20px;
                }
                .footer {
                    background: #f8f9fa;
                    padding: 20px;
                    text-align: center;
                    color: #666;
                    font-size: 14px;
                }
                .footer a {
                    color: #667eea;
                    text-decoration: none;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h1>📮 EchoNote</h1>
                    <p>Your letter from the past has arrived!</p>
                </div>
                <div class="content">
                    ${isReminder ? `<div class="reminder-badge">🔔 Reminder ${reminderNumber}</div>` : ''}
                    <h2 class="letter-title">${letterTitle}</h2>
                    <div class="letter-content">
                        ${letterContent.replace(/\n/g, '<br>')}
                    </div>
                    <p style="text-align: center; color: #666; font-style: italic;">
                        ${isReminder ?
            `This is reminder ${reminderNumber} for your letter.` :
            'This letter was scheduled to be delivered to you today.'
        }
                    </p>
                </div>
                <div class="footer">
                    <p>Sent with ❤️ by <a href="#">EchoNote</a></p>
                    <p>Your personal time capsule service</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
        EchoNote - Your Letter Has Arrived!
        ${isReminder ? `(Reminder ${reminderNumber})` : ''}

        Title: ${letterTitle}

        Content:
        ${letterContent}

        ${isReminder ?
            `This is reminder ${reminderNumber} for your letter.` :
            'This letter was scheduled to be delivered to you today.'
        }

        Sent with love by EchoNote - Your personal time capsule service
    `;

    return { subject, html, text };
};

// Send email function
export const sendEmail = async (
    to: string,
    subject: string,
    html: string,
    text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'EchoNote <noreply@echonote.com>',
            to,
            subject,
            html,
            text,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);

        return {
            success: true,
            messageId: info.messageId,
        };
    } catch (error) {
        console.error('Failed to send email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};

// Create email delivery record in database
export const createEmailDeliveryRecord = async (
    letterId: string,
    recipientEmail: string,
    subject: string,
    emailContent: string,
    deliveryType: EmailDeliveryType,
    attemptNumber: number = 1
) => {
    try {
        const emailDelivery = await db.emailDelivery.create({
            data: {
                letterId,
                recipientEmail,
                subject,
                emailContent,
                deliveryType,
                attemptNumber,
                status: 'PENDING',
            },
        });
        return emailDelivery;
    } catch (error) {
        console.error('Failed to create email delivery record:', error);
        throw error;
    }
};

// Update email delivery status
export const updateEmailDeliveryStatus = async (
    emailDeliveryId: string,
    status: EmailStatus,
    sentAt?: Date,
    errorMessage?: string
) => {
    try {
        const updatedDelivery = await db.emailDelivery.update({
            where: { id: emailDeliveryId },
            data: {
                status,
                sentAt,
                errorMessage,
                updatedAt: new Date(),
            },
        });
        return updatedDelivery;
    } catch (error) {
        console.error('Failed to update email delivery status:', error);
        throw error;
    }
};

// Send letter email (main function)
export const sendLetterEmail = async (
    letterId: string,
    deliveryType: EmailDeliveryType = 'INITIAL_DELIVERY',
    reminderNumber?: number
): Promise<{ success: boolean; emailDeliveryId?: string; error?: string }> => {
    try {
        // Get letter with user information
        const letter = await db.letter.findUnique({
            where: { id: letterId },
            include: {
                user: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
            },
        });

        if (!letter) {
            return { success: false, error: 'Letter not found' };
        }

        if (!letter.user.email) {
            return { success: false, error: 'User email not found' };
        }

        // Create email template
        const { subject, html, text } = createLetterEmailTemplate(
            letter.user.name,
            letter.title,
            letter.content,
            deliveryType,
            reminderNumber
        );

        // Create email delivery record
        const emailDelivery = await createEmailDeliveryRecord(
            letterId,
            letter.user.email,
            subject,
            html,
            deliveryType,
            reminderNumber || 1
        );

        // Send email
        const emailResult = await sendEmail(letter.user.email, subject, html, text);

        // Update delivery status
        if (emailResult.success) {
            await updateEmailDeliveryStatus(
                emailDelivery.id,
                'SENT',
                new Date()
            );

            // Update letter status to DELIVERED if this is the initial delivery
            if (deliveryType === 'INITIAL_DELIVERY') {
                await db.letter.update({
                    where: { id: letterId },
                    data: { status: 'DELIVERED' },
                });
            }

            return {
                success: true,
                emailDeliveryId: emailDelivery.id,
            };
        } else {
            await updateEmailDeliveryStatus(
                emailDelivery.id,
                'FAILED',
                undefined,
                emailResult.error
            );

            return {
                success: false,
                error: emailResult.error,
                emailDeliveryId: emailDelivery.id,
            };
        }
    } catch (error) {
        console.error('Failed to send letter email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};