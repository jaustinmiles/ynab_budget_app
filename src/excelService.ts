import ExcelJS from 'exceljs';
import {ICategories, ICategoryMap} from "./types/ynabTypes";
import {getBudgetCategoriesInMonth, readCategoryGroups} from "./ynabService";
import budgetConfigs from "../src/configs/budgets.json"

export async function writeBudgetsToExcel(budgets: ICategoryMap) {
    const workbook = new ExcelJS.Workbook();
    for (const [key, budget] of budgets.budgetCategories) {
        const worksheet = workbook.addWorksheet(key);
        const categories: ICategories = {
            budgetId: key,
            budgetCategories: budget
        }
        const monthlyCategoriesArr = await getBudgetCategoriesInMonth(categories)
        const monthlyCategories: ICategories = {
            budgetId: key,
            budgetCategories: monthlyCategoriesArr
        }
        const groupedCategories = readCategoryGroups(budgetConfigs.categoryGroupMap, monthlyCategories)
        let startColumn = 1;
        for (const [group, categories] of groupedCategories.budgetCategories.entries()) {
            const columns = [
                { name: 'Category', filterButton: true },
                { name: 'Activity', filterButton: true },
            ]
            const rows = categories.map((category) => {
                return [
                    category.name,
                    category.activity / 1000,
                ]
            })
            const ref = `${worksheet.getColumn(startColumn).letter}1`;
            worksheet.addTable({
                name: group, columns: columns, rows: rows, headerRow: true,
                ref: ref
            })
            startColumn += 3;
        }
    }

    // Save workbook to disk
    await workbook.xlsx.writeFile('budgets.xlsx');
}