import ExcelJS from 'exceljs';
import {ICategoryMap} from "./types/ynabTypes";

export async function writeBudgetsToExcel(budgets: ICategoryMap) {
    const workbook = new ExcelJS.Workbook();
    for (const [key, budget] of budgets.budgetCategories) {
        const worksheet = workbook.addWorksheet(key);

        // Add header row
        worksheet.columns = [
            { header: 'Budget ID', key: 'id', width: 30 },
            { header: 'Budget Name', key: 'name', width: 30 },
        ];

        // Add budget rows
        budget.forEach((category) => {
            worksheet.addRow({
                id: category.id,
                name: category.name,
                last_modified_on: category.activity,
            });
        });
    }

    // Save workbook to disk
    await workbook.xlsx.writeFile('budgets.xlsx');
}