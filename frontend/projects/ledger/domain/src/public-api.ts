export type WeightUnit = 'Kg' | 'Lbs';
export type ThemePreference = 'Light' | 'Dark' | 'System';
export interface Session { id: string; name: string; email: string; emailVerified: boolean; onboarded: boolean; }
export interface AuthResult { accessToken: string; accessTokenExpiresAt: string; userId: string; name: string; onboarded: boolean; }
export interface WeighIn { id: string; date: string; weightKg: number; note?: string; updatedAt: string; }
export interface GoalProgress { percentComplete: number; startWeightKg: number; currentWeightKg: number; goalWeightKg: number; remainingKg: number; targetDate: string; reached: boolean; hasSufficientData: boolean; pace: { weeklyRateKg: number; projectedDate?: string; message: string; }; }
export interface Dashboard { greeting: string; progress: GoalProgress; thisWeekChangeKg: number; averageWeeklyChangeKg: number; currentStreak: number; trend: WeighIn[]; nextBadge?: string; celebrations: string[]; }
export interface Preferences { unit: WeightUnit; theme: ThemePreference; weekStartsOn: 'Sunday'|'Monday'; timeZone: string; reminderEnabled: boolean; reminderTime: string; quietHoursEnabled: boolean; quietHoursStart: string; quietHoursEnd: string; }
export interface ProblemDetails { title: string; status: number; code: string; errors?: Record<string,string[]>; }
