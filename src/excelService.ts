import ExcelJS from 'exceljs';
import {
  ICategories,
  ICategoryMap,
  IExcelColumn,
  IExcelTable,
} from './types/ynabTypes';
import { getBudgetCategoriesInMonth, readCategoryGroups } from './ynabService';
import budgetConfigs from '../src/configs/budgets.json';

function getExcelRef(
  worksheet: ExcelJS.Worksheet,
  startColumn: number,
  row: number,
) {
  return `${worksheet.getColumn(startColumn).letter}${row}`;
}

export async function writeBudgetsToExcel(budgets: ICategoryMap) {
  const workbook = new ExcelJS.Workbook();
  for (const [key, budget] of budgets.budgetCategories) {
    const worksheet = workbook.addWorksheet(key);
    const categories: ICategories = {
      budgetId: key,
      budgetCategories: budget,
    };
    const monthlyCategoriesArr = await getBudgetCategoriesInMonth(categories);
    const monthlyCategories: ICategories = {
      budgetId: key,
      budgetCategories: monthlyCategoriesArr,
    };
    const groupedCategories = readCategoryGroups(
      budgetConfigs.categoryGroupMap,
      monthlyCategories,
    );
    let startColumn = 1;
    const excelTables: IExcelTable[] = [];
    for (const [
      group,
      categories,
    ] of groupedCategories.budgetCategories.entries()) {
      // TODO: this is basically copy and paste, needs refactor
      const ref = getExcelRef(worksheet, startColumn, 1);
      const categoryRows = categories.map((category) => category.name);
      const categoryColumn: IExcelColumn<string> = {
        ref: ref,
        columnNumber: startColumn,
        name: 'Category',
        data: categoryRows,
      };

      const ref2 = getExcelRef(worksheet, startColumn + 1, 1);
      const activityRows = categories.map(
        (category) => category.activity / 1000,
      );
      const activityColumn: IExcelColumn<number> = {
        ref: ref2,
        columnNumber: startColumn + 1,
        name: 'Activity',
        data: activityRows,
      };

      const ref3 = getExcelRef(worksheet, startColumn + 2, 1);
      const categoryIdRows = categories.map((category) => category.id);
      const categoryIdColumn: IExcelColumn<string> = {
        ref: ref3,
        columnNumber: startColumn + 2,
        name: 'CategoryId',
        data: categoryIdRows,
        hidden: true,
      };

      const excelTable: IExcelTable = {
        ref: ref,
        name: group,
        data: [categoryColumn, activityColumn, categoryIdColumn],
      };

      excelTables.push(excelTable);

      startColumn += 3;
    }

    for (const excelTable of excelTables) {
      const columData = excelTable.data;
      const rowLength = columData[0]?.data.length;
      if (!rowLength) {
        continue;
      }
      const rows = [];
      for (let i = 0; i < rowLength; i++) {
        const row = [];
        for (let j = 0; j < columData.length; j++) {
          if (columData[j].hidden) {
            continue;
          }
          row.push(columData[j].data[i]);
        }
        rows.push(row);
      }

      const columns = [];
      for (const col of columData) {
        if (col.hidden) {
          continue;
        }
        columns.push({
          name: col.name,
          filterButton: true,
        });
      }
      const table = worksheet.addTable({
        name: excelTable.name,
        columns: columns,
        rows: rows,
        headerRow: true,
        ref: excelTable.ref,
      });
      table.style = {
        showRowStripes: true,
        showColumnStripes: true,
      };
    }
    // add totals cells
    const totals: Array<Array<unknown>> = [];
    for (const excelTable of excelTables) {
      const activityColumn = excelTable.data[1];

      const lastColumnCellRef = getExcelRef(
        worksheet,
        activityColumn.columnNumber,
        activityColumn.data.length + 1,
      );
      totals.push([
        excelTable.name,
        {
          formula: `SUM(${activityColumn.ref}:${lastColumnCellRef})`,
        },
      ]);
    }

    const totalsColumns = [
      { name: 'Category', filterButton: true },
      { name: 'Total', filterButton: true },
    ];
    const totalsRef = getExcelRef(worksheet, startColumn, 1);
    const totalsTable = worksheet.addTable({
      ref: totalsRef,
      name: 'Totals',
      columns: totalsColumns,
      rows: totals,
      headerRow: true,
    });
    totalsTable.style = {
      showRowStripes: true,
      showColumnStripes: true,
    };
  }

  // Save workbook to disk
  await workbook.xlsx.writeFile('budgets.xlsx');
}
