import "server-only";
import { database as db } from "@/lib/database";
import { requireMenuAccess } from "@/lib/authorization";
import { jakartaToday } from "@/lib/plt-dates";
import { libraryPeriodWindow, libraryMonthLabel, type LibrarySnapshot, type LibraryPeriodTotals, type LibraryMonthStatistics, type LibraryCategoryStatistics, type LibraryPopularBook, type LibraryStatistics } from "@/lib/library-statistics-types";

export async function getLibraryStatistics(input: unknown): Promise<LibraryStatistics> {
  await requireMenuAccess("perpustakaan-statistik");
  const window = libraryPeriodWindow(input), today = jakartaToday();
  const [snapshot, activity, trend, categories, popularBooks] = await Promise.all([
    // All stock figures share one statement/snapshot, including concurrent returns.
    db.prepare(`SELECT books.bookEntries, books.activeBooks, books.totalCopies, books.availableCopies,
      visitors.registeredVisitors, visitors.activeVisitors, visitors.employeeVisitors,
      loans.openLoans, loans.borrowedCopies, loans.overdueLoans FROM
      (SELECT COUNT(*) AS bookEntries, COALESCE(SUM(CASE WHEN b.is_active = 1 THEN 1 ELSE 0 END),0) AS activeBooks,
        COALESCE(SUM(b.copies),0) AS totalCopies,
        COALESCE(SUM(CASE WHEN b.is_active = 1 THEN b.copies - COALESCE(active.quantity,0) ELSE 0 END),0) AS availableCopies
        FROM library_books b LEFT JOIN
          (SELECT book_id, SUM(quantity) AS quantity FROM library_loans WHERE return_date IS NULL GROUP BY book_id) active ON active.book_id = b.id) books
      CROSS JOIN (SELECT COUNT(*) AS registeredVisitors,
        COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END),0) AS activeVisitors,
        COALESCE(SUM(CASE WHEN employee_nip IS NOT NULL THEN 1 ELSE 0 END),0) AS employeeVisitors FROM library_visitors) visitors
      CROSS JOIN (SELECT COALESCE(SUM(CASE WHEN return_date IS NULL THEN 1 ELSE 0 END),0) AS openLoans,
        COALESCE(SUM(CASE WHEN return_date IS NULL THEN quantity ELSE 0 END),0) AS borrowedCopies,
        COALESCE(SUM(CASE WHEN return_date IS NULL AND due_date < ? THEN 1 ELSE 0 END),0) AS overdueLoans FROM library_loans) loans`).get<LibrarySnapshot>(today),
    db.prepare(`SELECT visits.visits, visits.uniqueVisitors, loans.loans, loans.loanCopies, loans.returns, loans.returnCopies FROM
      (SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS uniqueVisitors FROM library_visits WHERE visit_date >= ? AND visit_date < ?) visits
      CROSS JOIN (SELECT COALESCE(SUM(CASE WHEN loan_date >= ? AND loan_date < ? THEN 1 ELSE 0 END),0) AS loans,
        COALESCE(SUM(CASE WHEN loan_date >= ? AND loan_date < ? THEN quantity ELSE 0 END),0) AS loanCopies,
        COALESCE(SUM(CASE WHEN return_date >= ? AND return_date < ? THEN 1 ELSE 0 END),0) AS returns,
        COALESCE(SUM(CASE WHEN return_date >= ? AND return_date < ? THEN quantity ELSE 0 END),0) AS returnCopies FROM library_loans) loans`)
      .get<LibraryPeriodTotals>(window.start, window.end, window.start, window.end, window.start, window.end, window.start, window.end, window.start, window.end),
    db.prepare(`SELECT month, SUM(visits) AS visits, SUM(loans) AS loans, SUM(returns) AS returns FROM (
      SELECT SUBSTR(visit_date,1,7) AS month, COUNT(*) AS visits, 0 AS loans, 0 AS returns FROM library_visits WHERE visit_date >= ? AND visit_date < ? GROUP BY SUBSTR(visit_date,1,7)
      UNION ALL SELECT SUBSTR(loan_date,1,7) AS month, 0 AS visits, COUNT(*) AS loans, 0 AS returns FROM library_loans WHERE loan_date >= ? AND loan_date < ? GROUP BY SUBSTR(loan_date,1,7)
      UNION ALL SELECT SUBSTR(return_date,1,7) AS month, 0 AS visits, 0 AS loans, COUNT(*) AS returns FROM library_loans WHERE return_date >= ? AND return_date < ? GROUP BY SUBSTR(return_date,1,7)
      ) monthly GROUP BY month ORDER BY month`).all<Omit<LibraryMonthStatistics, "label">>(window.trendStart, window.end, window.trendStart, window.end, window.trendStart, window.end),
    db.prepare(`SELECT COALESCE(NULLIF(lower(trim(category)),''),'tanpa kategori') AS category, COUNT(*) AS entries, COALESCE(SUM(copies),0) AS copies
      FROM library_books GROUP BY COALESCE(NULLIF(lower(trim(category)),''),'tanpa kategori') ORDER BY copies DESC, category`).all<LibraryCategoryStatistics>(),
    db.prepare(`SELECT b.id, b.inventory_code AS inventoryCode, b.title, COUNT(*) AS loans, SUM(l.quantity) AS copies
      FROM library_loans l JOIN library_books b ON b.id = l.book_id WHERE l.loan_date >= ? AND l.loan_date < ?
      GROUP BY b.id, b.inventory_code, b.title ORDER BY copies DESC, loans DESC, b.title, b.id LIMIT 5`).all<LibraryPopularBook>(window.start, window.end),
  ]);
  const byMonth = new Map(trend.map(row => [row.month, row]));
  return {
    today, period: window.period, periodLabel: libraryMonthLabel(window.period), snapshot: snapshot!, activity: activity!, categories, popularBooks,
    months: window.months.map(month => ({ month, label: libraryMonthLabel(month, true), visits: byMonth.get(month)?.visits ?? 0, loans: byMonth.get(month)?.loans ?? 0, returns: byMonth.get(month)?.returns ?? 0 })),
  };
}
