import {getBudgets, readBudgetConfigs} from './ynabService';
import { writeBudgetsToExcel } from './excelService';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
    try {
        const budgetsToProcess = readBudgetConfigs();
        const budgets = await getBudgets(budgetsToProcess);
        await writeBudgetsToExcel(budgets);
        console.log('Budget data written to Excel successfully!');
    } catch (error) {
        console.error('Error:', error);
    }
})();