import * as ynab from 'ynab';
import {ICategoryMap} from "./types/ynabTypes";
import budgetConfigs from "../src/configs/budgets.json"

export async function getBudgets(budgetIds: string[]): Promise<ICategoryMap> {
    const budgets: Array<ynab.BudgetDetail> = []
    const ynabApi = createYnabApi();
    for (const budgetId of budgetIds) {
        const budget = await ynabApi.budgets.getBudgetById(budgetId)
        budgets.push(budget.data.budget)
    }
    const budgetMap: ICategoryMap = {
        budgetCategories: new Map()
    }
    for (const budget of budgets) {
        if (budget.categories) {
            budgetMap.budgetCategories.set(budget.id, budget.categories)
        }
    }
    return budgetMap
}

export function createYnabApi() {
    const ynabApiToken = process.env.YNAB_API_TOKEN;
    if (!ynabApiToken) {
        throw new Error('Please add your YNAB_API_TOKEN to the .env file.');
    }
    return new ynab.API(ynabApiToken);
}

export function readBudgetConfigs(): string[] {
    return budgetConfigs.budgetsToProcess
}
