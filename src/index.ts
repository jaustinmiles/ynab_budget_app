import { getBudgets, readBudgetConfigs } from './ynabService';
import { writeBudgetsToExcel } from './excelService';
import * as dotenv from 'dotenv';
import { YnabCacheDatabaseService } from './ynabCacheDatabaseService';
import ExcelJS from 'exceljs';

dotenv.config();

function monthToISOString(monthName: string, year: number) {
  // Map of month names to month numbers
  const monthMap: { [key: string]: number } = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11,
  };

  // Normalize input to handle case-insensitive names
  const normalizedMonth =
    monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();

  if (!(normalizedMonth in monthMap)) {
    throw new Error(`Invalid month name: ${monthName}`);
  }

  const monthNumber = monthMap[normalizedMonth];
  if (monthNumber === undefined) {
    throw new Error(`Invalid month name: ${monthName}`);
  }

  // Create date object and return ISO string
  const date = new Date(year, monthNumber, 1);

  const isoString = date.toISOString();
  // YYYY-MM-DD
  return isoString.split('T')[0];
}

(async () => {
  const months = [
    monthToISOString('January', 2025),
    monthToISOString('November', 2024),
    monthToISOString('December', 2024),
  ];
  const workbook = new ExcelJS.Workbook();
  for (const month of months) {
    console.log(`Processing budgets for ${month}`);
    try {
      const budgetsToProcess = readBudgetConfigs();
      const budgets = await getBudgets(budgetsToProcess, month);
      await writeBudgetsToExcel(budgets, month, workbook);
      console.log('Budget data written to Excel successfully!');
    } catch (error) {
      console.error('Error:', error);
    }
  }
  YnabCacheDatabaseService.destruct();
  // Save workbook to disk
  await workbook.xlsx.writeFile('budgets.xlsx');
})();
