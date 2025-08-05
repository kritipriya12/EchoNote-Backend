import * as cron from 'node-cron';
import { db } from '../lib/db';
import { sendLetterEmail, verifyEmailConfig } from '../utils/email';

class EmailSchedulerService {
    private isRunning = false;
    private cronJob: cron.ScheduledTask | null = null;

    constructor() {
        this.initializeScheduler();
    }

    private async initializeScheduler() {
        const isEmailConfigValid = await verifyEmailConfig();
        if (!isEmailConfigValid) {
            console.error('Email configuration is invalid. Email scheduler will not start.');
            return;
        }

        this.cronJob = cron.schedule('* * * * *', async () => {
            if (this.isRunning) {
                console.log('Email scheduler is already running, skipping this cycle');
                return;
            }

            this.isRunning = true;
            try {
                await this.processScheduledEmails();
            } catch (error) {
                console.error('Error in email scheduler:', error);
            } finally {
                this.isRunning = false;
            }
        });

        console.log('Email scheduler initialized');
    }

    public start() {
        if (this.cronJob) {
            this.cronJob.start();
            console.log('Email scheduler started - checking every minute for letters to deliver');
        }
    }

    public stop() {
        if (this.cronJob) {
            this.cronJob.destroy();
            console.log('Email scheduler stopped');
        }
    }

    private async processScheduledEmails() {
        const now = new Date();
        console.log(`Checking for letters to deliver at ${now.toISOString()}`);

        try {
            const lettersToDeliver = await db.letter.findMany({
                where: {
                    status: 'PENDING',
                    deliveryDate: {
                        lte: now,
                    },
                },
                include: {
                    user: {
                        select: {
                            email: true,
                            name: true,
                        },
                    },
                    emailDeliveries: {
                        orderBy: {
                            createdAt: 'desc',
                        },
                    },
                },
            });

            console.log(`Found ${lettersToDeliver.length} letters ready for delivery`);

            for (const letter of lettersToDeliver) {
                await this.processLetterDelivery(letter);
            }

            await this.processReminders();

        } catch (error) {
            console.error('Error processing scheduled emails:', error);
        }
    }

    private async processLetterDelivery(letter: any) {
        try {
            const initialDelivery = letter.emailDeliveries.find(
                (delivery: any) => delivery.deliveryType === 'INITIAL_DELIVERY'
            );

            if (!initialDelivery) {
                console.log(`Sending initial delivery for letter: ${letter.title} to ${letter.user.email}`);

                const result = await sendLetterEmail(letter.id, 'INITIAL_DELIVERY');

                if (result.success) {
                    console.log(`Successfully sent initial delivery for letter: ${letter.title}`);
                } else {
                    console.error(`Failed to send initial delivery for letter: ${letter.title}`, result.error);
                }
            }
        } catch (error) {
            console.error(`Error processing letter delivery for letter ${letter.id}:`, error);
        }
    }

    private async processReminders() {
        try {
            const deliveredLetters = await db.letter.findMany({
                where: {
                    status: 'DELIVERED',
                    reminders: {
                        gt: 1, 
                    },
                },
                include: {
                    user: {
                        select: {
                            email: true,
                            name: true,
                        },
                    },
                    emailDeliveries: {
                        orderBy: {
                            createdAt: 'desc',
                        },
                    },
                },
            });

            for (const letter of deliveredLetters) {
                await this.processLetterReminders(letter);
            }

        } catch (error) {
            console.error('Error processing reminders:', error);
        }
    }

    private async processLetterReminders(letter: any) {
        try {
            const totalReminders = letter.reminders;
            const sentReminders = letter.emailDeliveries.filter(
                (delivery: any) => delivery.deliveryType === 'REMINDER'
            );

            const nextReminderNumber = sentReminders.length + 1;

            if (nextReminderNumber <= totalReminders) {
                const initialDelivery = letter.emailDeliveries.find(
                    (delivery: any) => delivery.deliveryType === 'INITIAL_DELIVERY' && delivery.status === 'SENT'
                );

                if (!initialDelivery) {
                    return;
                }

                const lastReminderDelivery = sentReminders.find(
                    (delivery: any) => delivery.status === 'SENT'
                );

                const lastSentTime = lastReminderDelivery ?
                    new Date(lastReminderDelivery.sentAt) :
                    new Date(initialDelivery.sentAt);

                const now = new Date();
                const hoursSinceLastSent = (now.getTime() - lastSentTime.getTime()) / (1000 * 60 * 60);

               
                if (hoursSinceLastSent >= 24) {
                    console.log(`Sending reminder ${nextReminderNumber} for letter: ${letter.title}`);

                    const result = await sendLetterEmail(letter.id, 'REMINDER', nextReminderNumber);

                    if (result.success) {
                        console.log(`Successfully sent reminder ${nextReminderNumber} for letter: ${letter.title}`);
                    } else {
                        console.error(`Failed to send reminder ${nextReminderNumber} for letter: ${letter.title}`, result.error);
                    }
                }
            }
        } catch (error) {
            console.error(`Error processing reminders for letter ${letter.id}:`, error);
        }
    }

    public async triggerManualCheck() {
        if (this.isRunning) {
            console.log('Email scheduler is already running');
            return;
        }

        console.log('Manually triggering email check...');
        await this.processScheduledEmails();
    }

    public getStatus() {
        return {
            isRunning: this.isRunning,
            isScheduled: this.cronJob ? 'active' : 'inactive',
        };
    }
}

export const emailScheduler = new EmailSchedulerService();

export { EmailSchedulerService };
