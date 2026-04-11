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

    const [
      totalApplications,
      draftApplications,
      unpaidApplications,
      submittedApplications,
      inReviewApplications,
      approvedApplications,
      rejectedApplications,
      totalPayments,
      paidPayments,
      failedPayments,
      pendingPayments,
      totalPortalUsers,
      totalAdminUsers,
      totalRevenueResult,
      todayRevenueResult,
    ] = await Promise.all([
      // Application counts
      this.prisma.application.count({ where: { deletedAt: null } }),
      this.prisma.application.count({
        where: { currentStatus: ApplicationStatus.DRAFT, deletedAt: null },
      }),
      this.prisma.application.count({
        where: { currentStatus: ApplicationStatus.UNPAID, deletedAt: null },
      }),
      this.prisma.application.count({
        where: { currentStatus: ApplicationStatus.SUBMITTED, deletedAt: null },
      }),
      this.prisma.application.count({
        where: { currentStatus: ApplicationStatus.IN_REVIEW, deletedAt: null },
      }),
      this.prisma.application.count({
        where: { currentStatus: ApplicationStatus.APPROVED, deletedAt: null },
      }),
      this.prisma.application.count({
        where: { currentStatus: ApplicationStatus.REJECTED, deletedAt: null },
      }),
      // Payment counts
      this.prisma.payment.count({ where: { deletedAt: null } }),
      this.prisma.payment.count({
        where: { paymentStatus: PaymentStatus.PAID, deletedAt: null },
      }),
      this.prisma.payment.count({
        where: { paymentStatus: PaymentStatus.FAILED, deletedAt: null },
      }),
      this.prisma.payment.count({
        where: { paymentStatus: PaymentStatus.PENDING, deletedAt: null },
      }),
      // User counts
      this.prisma.portalIdentity.count(),
      this.prisma.user.count({ where: { deletedAt: null } }),
      // Revenue
      this.prisma.payment.aggregate({
        where: { paymentStatus: PaymentStatus.PAID, deletedAt: null },
        _sum: { totalAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: { gte: today },
          deletedAt: null,
        },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      totalApplications,
      draftApplications,
      unpaidApplications,
      submittedApplications,
      inReviewApplications,
      approvedApplications,
      rejectedApplications,
      totalPayments,
      paidPayments,
      failedPayments,
      pendingPayments,
      totalPortalUsers,
      totalAdminUsers,
      totalRevenue: totalRevenueResult._sum?.totalAmount?.toNumber() || 0,
      revenueToday: todayRevenueResult._sum?.totalAmount?.toNumber() || 0,
    };
  }

  async getCharts(): Promise<DashboardChartsDto> {
    const [
      applicationsByStatus,
      paymentsByStatus,
      applicationsByDestination,
      revenueByMonth,
      recentDailyApplications,
    ] = await Promise.all([
      this.getApplicationsByStatus(),
      this.getPaymentsByStatus(),
      this.getApplicationsByDestination(),
      this.getRevenueByMonth(),
      this.getRecentDailyApplications(),
    ]);

    return {
      applicationsByStatus,
      paymentsByStatus,
      applicationsByDestination,
      revenueByMonth,
      recentDailyApplications,
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

  private async getPaymentsByStatus() {
    const results = await this.prisma.payment.groupBy({
      by: ['paymentStatus'],
      where: { deletedAt: null },
      _count: { paymentStatus: true },
    });

    return results.map(r => ({
      status: r.paymentStatus,
      count: r._count.paymentStatus,
    }));
  }

  private async getApplicationsByDestination() {
    const results = await this.prisma.application.groupBy({
      by: ['destinationCountryId'],
      where: { deletedAt: null },
      _count: { destinationCountryId: true },
      orderBy: { _count: { destinationCountryId: 'desc' } },
      take: 10,
    });

    const countryIds = results.map(r => r.destinationCountryId).filter(Boolean) as string[];
    const countries = await this.prisma.country.findMany({
      where: { id: { in: countryIds } },
      select: { id: true, isoCode: true, name: true },
    });

    const countryMap = new Map(countries.map(c => [c.id, c]));

    return results.map(r => {
      const country = r.destinationCountryId ? countryMap.get(r.destinationCountryId) : null;
      return {
        countryCode: country?.isoCode || 'UNKNOWN',
        countryName: country?.name || 'Unknown',
        count: r._count.destinationCountryId,
      };
    });
  }

  private async getRevenueByMonth() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const payments = await this.prisma.payment.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: { gte: sixMonthsAgo },
        deletedAt: null,
      },
      select: { totalAmount: true, paidAt: true },
    });

    const monthlyRevenue = new Map<string, number>();
    payments.forEach(p => {
      if (p.paidAt) {
        const month = p.paidAt.toISOString().slice(0, 7);
        monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + p.totalAmount.toNumber());
      }
    });

    return Array.from(monthlyRevenue.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private async getRecentDailyApplications() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const applications = await this.prisma.application.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        deletedAt: null,
      },
      select: { createdAt: true },
    });

    const dailyCounts = new Map<string, number>();
    applications.forEach(app => {
      const date = app.createdAt.toISOString().slice(0, 10);
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    });

    return Array.from(dailyCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
