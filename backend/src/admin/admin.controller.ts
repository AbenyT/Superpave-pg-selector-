import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { AnalysesRepository } from '../analyses/analysis.repository';
import { isAdminEmail } from '../auth/auth.service';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { UsersRepository } from '../auth/users.repository';

const DAYS = 30;
const DAY_MS = 86_400_000;

/** "2026-10-22" in UTC. */
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * GET /admin/stats (site owner only) → totals and the last 30 days of sign-ups and analyses.
 * Counts only: no emails, names or project data leave the server.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly users: UsersRepository, private readonly analyses: AnalysesRepository) {}

  @Get('stats')
  async stats(@CurrentUser() user: AuthUser) {
    if (!isAdminEmail(user.email)) {
      throw new ForbiddenException({ message: 'This page is only for the site owner.', code: 'NOT_ADMIN' });
    }
    const [signUps, analyses] = await Promise.all([this.users.signUpDates(), this.analyses.activity()]);
    const now = Date.now();
    const since = (days: number) => (d: Date) => now - d.getTime() < days * DAY_MS;

    const today = new Date(now);
    const days = Array.from({ length: DAYS }, (_, i) => dayKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (DAYS - 1 - i)))));
    const perDay = new Map(days.map((d) => [d, { date: d, signUps: 0, analyses: 0 }]));
    for (const d of signUps) {
      const day = perDay.get(dayKey(d));
      if (day) day.signUps += 1;
    }
    for (const a of analyses) {
      const day = perDay.get(dayKey(a.createdAt));
      if (day) day.analyses += 1;
    }

    const grades = new Map<string, number>();
    for (const a of analyses) grades.set(a.finalGrade, (grades.get(a.finalGrade) ?? 0) + 1);

    return {
      accounts: { total: signUps.length, last7Days: signUps.filter(since(7)).length, last30Days: signUps.filter(since(30)).length },
      analyses: {
        total: analyses.length,
        last7Days: analyses.filter((a) => since(7)(a.createdAt)).length,
        last30Days: analyses.filter((a) => since(30)(a.createdAt)).length,
        activeAccounts30Days: new Set(analyses.filter((a) => a.ownerId && since(30)(a.createdAt)).map((a) => a.ownerId)).size,
      },
      perDay: [...perDay.values()],
      grades: [...grades].map(([grade, count]) => ({ grade, count })).sort((a, b) => b.count - a.count),
    };
  }
}
