import ExcelJS from 'exceljs';
import * as ynab from 'ynab';
import {
  ICategories,
  ICategoryMap,
  IExcelColumn,
  IExcelColumnHeader,
  IExcelTable,
} from './types/ynabTypes';
import { getBudgetCategoriesInMonth, readCategoryGroups } from './ynabService';
import budgetConfigs from '../src/configs/budgets.json';
import { Category } from 'ynab';

function getExcelRef(
  worksheet: ExcelJS.Worksheet,
  startColumn: number,
  row: number,
) {
  return `${worksheet.getColumn(startColumn).letter}${row}`;
}

function getColumnFromHeaderInfo<T>(
  categories: Array<Category>,
  columnHeader: IExcelColumnHeader<T>,
  columnIndex: number,
  worksheet: ExcelJS.Worksheet,
): IExcelColumn<T> {
  const rows = categories.map((category) => {
    const data = (category as never)[columnHeader.dataKey] as T;
    if (columnHeader.transformFunc) {
      return columnHeader.transformFunc(data);
    }
    return data;
  });
  const ref = getExcelRef(worksheet, columnIndex, 1);
  return {
    ref: ref,
    columnNumber: columnIndex,
    name: columnHeader.name,
    data: rows,
    hidden: false,
  };
}

function getColumnsFromHeaderInfo(
  categories: Array<ynab.Category>,
  columnHeaders: (IExcelColumnHeader<string> | IExcelColumnHeader<number>)[],
  columnIndex: number,
  worksheet: ExcelJS.Worksheet,
) {
  const columns: (IExcelColumn<number> | IExcelColumn<string>)[] = [];
  const filteredHeaders = columnHeaders.filter((col) => !col.hidden);
  for (let i = 0; i < filteredHeaders.length; i++) {
    const header = filteredHeaders[i];
    if (header.dataType === 'string')
      columns.push(
        getColumnFromHeaderInfo(
          categories,
          header as IExcelColumnHeader<string>,
          columnIndex + i,
          worksheet,
        ),
      );
    else
      columns.push(
        getColumnFromHeaderInfo(
          categories,
          header as IExcelColumnHeader<number>,
          columnIndex + i,
          worksheet,
        ),
      );
  }
  return columns;
}

function addTotalsTable(
  excelTables: IExcelTable[],
  worksheet: ExcelJS.Worksheet,
  startColumn: number,
) {
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

export function writeTransactionsToExcel(
  budgets: ICategoryMap,
  workbook: ExcelJS.Workbook,
) {
  for (const [key, transactions] of budgets.budgetTransactions) {
    const worksheet = workbook.addWorksheet(
      `${key.substring(0, 10)}_transactions`,
    );
    const columns = [
      {
        name: 'payee',
        filterButton: true,
      },
      {
        name: 'amount',
        filterButton: true,
      },
    ];
    const rows = transactions.map((transaction) => {
      return [transaction.payee_name, transaction.amount / 1000];
    });
    const ref = getExcelRef(worksheet, 1, 1);
    worksheet.addTable({
      name: `${key.substring(0, 10)}_transactions`,
      columns: columns,
      rows: rows,
      headerRow: true,
      ref: ref,
    });
  }
}

export async function writeBudgetsToExcel(budgets: ICategoryMap) {
  const workbook = new ExcelJS.Workbook();
  writeTransactionsToExcel(budgets, workbook);
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
    const categoryHeader: IExcelColumnHeader<string> = {
      name: 'Category',
      dataKey: 'name',
      dataType: 'string',
      hidden: false,
    };
    const activityHeader: IExcelColumnHeader<number> = {
      name: 'Activity',
      dataKey: 'activity',
      dataType: 'number',
      hidden: false,
      transformFunc: (item: number) => {
        return item / 1000;
      },
    };
    const categoryIdHeader: IExcelColumnHeader<string> = {
      name: 'CategoryId',
      dataKey: 'id',
      dataType: 'string',
      hidden: true,
    };

    const columnHeaders: (
      | IExcelColumnHeader<string>
      | IExcelColumnHeader<number>
    )[] = [categoryHeader, activityHeader, categoryIdHeader];
    for (const [
      group,
      categories,
    ] of groupedCategories.budgetCategories.entries()) {
      const ref = getExcelRef(worksheet, startColumn, 1);
      const excelColumns = getColumnsFromHeaderInfo(
        categories,
        columnHeaders,
        startColumn,
        worksheet,
      );

      const excelTable: IExcelTable = {
        ref: ref,
        name: group,
        data: excelColumns,
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
    addTotalsTable(excelTables, worksheet, startColumn);
  }

  // Save workbook to disk
  await workbook.xlsx.writeFile('budgets.xlsx');
}
