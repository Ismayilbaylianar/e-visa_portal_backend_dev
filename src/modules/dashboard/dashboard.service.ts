import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardSummaryDto, DashboardChartsDto } from './dto';
import { ApplicationStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalApplications, pendingApplications, approvedToday, revenueResult] =
      await Promise.all([
        this.prisma.application.count({ where: { deletedAt: null } }),
        this.prisma.application.count({
          where: { currentStatus: ApplicationStatus.SUBMITTED, deletedAt: null },
        }),
        this.prisma.application.count({
          where: {
            currentStatus: ApplicationStatus.APPROVED,
            updatedAt: { gte: today },
            deletedAt: null,
          },
        }),
        this.prisma.payment.aggregate({
          where: { paymentStatus: PaymentStatus.PAID },
          _sum: { totalAmount: true },
        }),
      ]);

    return {
      totalApplications,
      pendingApplications,
      approvedToday,
      revenue: revenueResult._sum?.totalAmount?.toNumber() || 0,
    };
  }

  async getCharts(): Promise<DashboardChartsDto> {
    const [applicationsByStatus, applicationsByCountry, revenueByMonth] = await Promise.all([
      this.getApplicationsByStatus(),
      this.getApplicationsByCountry(),
      this.getRevenueByMonth(),
    ]);

    return {
      applicationsByStatus,
      applicationsByCountry,
      revenueByMonth,
    };
  }

  private async getApplicationsByStatus() {
    const results = await this.prisma.application.groupBy({
      by: ['currentStatus'],
      where: { deletedAt: null },
      _count: { currentStatus: true },
    });

    return results.map(r => ({
      status: r.currentStatus,
      count: r._count.currentStatus,
    }));
  }

  private async getApplicationsByCountry() {
    const results = await this.prisma.application.groupBy({
      by: ['nationalityCountryId'],
      where: { deletedAt: null },
      _count: { nationalityCountryId: true },
      orderBy: { _count: { nationalityCountryId: 'desc' } },
      take: 10,
    });

    const countryIds = results.map(r => r.nationalityCountryId).filter(Boolean) as string[];
    const countries = await this.prisma.country.findMany({
      where: { id: { in: countryIds } },
      select: { id: true, isoCode: true, name: true },
    });

    const countryMap = new Map(countries.map(c => [c.id, c]));

    return results.map(r => {
      const country = r.nationalityCountryId ? countryMap.get(r.nationalityCountryId) : null;
      return {
        countryCode: country?.isoCode || 'UNKNOWN',
        countryName: country?.name || 'Unknown',
        count: r._count.nationalityCountryId,
      };
    });
  }

  private async getRevenueByMonth() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const payments = await this.prisma.payment.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        createdAt: { gte: sixMonthsAgo },
      },
      select: { totalAmount: true, createdAt: true },
    });

    const monthlyRevenue = new Map<string, number>();
    payments.forEach(p => {
      const month = p.createdAt.toISOString().slice(0, 7);
      monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + p.totalAmount.toNumber());
    });

    return Array.from(monthlyRevenue.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
