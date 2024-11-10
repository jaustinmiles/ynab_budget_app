import * as ynab from 'ynab';
import {
  ICategories,
  ICategoryMap,
  IGroupedCategories,
  YnabCategoryGroupMap,
} from './types/ynabTypes';
import budgetConfigs from '../src/configs/budgets.json';
import { mapGetOrSet } from './utils';
import {
  CacheFunctions,
  getCachedYnabResponse,
} from './ynabCacheDatabaseService';

export async function getBudgets(budgetIds: string[]): Promise<ICategoryMap> {
  const budgets: Array<ynab.BudgetDetail> = [];
  const budgetMap: ICategoryMap = {
    budgetCategories: new Map(),
    budgetTransactions: new Map(),
  };
  for (const budgetId of budgetIds) {
    const budget = (await getCachedYnabResponse(
      [budgetId],
      CacheFunctions.GET_BUDGET_BY_ID,
    )) as ynab.BudgetDetailResponse;
    budgets.push(budget.data.budget);
    const transactions = await getBudgetTransactionsInMonth(budgetId);
    budgetMap.budgetTransactions.set(budgetId, transactions.data.transactions);
  }
  for (const budget of budgets) {
    if (budget.categories) {
      budgetMap.budgetCategories.set(budget.id, budget.categories);
    }
  }
  return budgetMap;
}

export async function getBudgetCategoriesInMonth(
  categories: ICategories,
  month: string = 'current',
): Promise<Array<ynab.Category>> {
  const monthlyCategories: Array<ynab.Category> = [];
  for (const category of categories.budgetCategories) {
    const monthlyCategory = (await getCachedYnabResponse(
      [categories.budgetId, month, category.id],
      CacheFunctions.GET_MONTH_CATEGORY_BY_ID,
    )) as ynab.CategoryResponse;
    monthlyCategories.push(monthlyCategory.data.category);
  }
  return monthlyCategories;
}

export async function getBudgetTransactionsInMonth(
  budgetId: string,
  month: string = 'current',
) {
  return (await getCachedYnabResponse(
    [budgetId, month],
    CacheFunctions.GET_MONTH_TRANSACTION_BY_ID,
  )) as ynab.HybridTransactionsResponse;
}

export function createYnabApi() {
  const ynabApiToken = process.env.YNAB_API_TOKEN;
  if (!ynabApiToken) {
    throw new Error('Please add your YNAB_API_TOKEN to the .env file.');
  }
  return new ynab.API(ynabApiToken);
}

export function readBudgetConfigs(): string[] {
  return budgetConfigs.budgetsToProcess;
}

function buildReverseCategoryMapping(
  inputMap: YnabCategoryGroupMap,
  categories: ICategories,
) {
  const reverseMap = new Map<string, string>();
  const budgetMapping = inputMap[categories.budgetId];
  for (const [group, categoryIds] of Object.entries(budgetMapping)) {
    for (const categoryId of categoryIds) {
      if (reverseMap.has(categoryId)) {
        throw new Error(
          `Duplicate category id ${categoryId} found in input map`,
        );
      }
      mapGetOrSet(reverseMap, categoryId, group);
    }
  }
  return reverseMap;
}

export function readCategoryGroups(
  inputMap: YnabCategoryGroupMap,
  categories: ICategories,
): IGroupedCategories {
  if (!Object.keys(inputMap).includes(categories.budgetId)) {
    throw new Error(`Budget key ${categories.budgetId} not found in input map`);
  }
  const reverseMap = buildReverseCategoryMapping(inputMap, categories);
  const groupedCategories: IGroupedCategories = {
    budgetId: categories.budgetId,
    budgetCategories: new Map(),
  };
  for (const category of categories.budgetCategories) {
    const group = reverseMap.get(category.id);
    if (!group) {
      throw new Error(`Category id ${category.id} not found in input map`);
    }
    mapGetOrSet(groupedCategories.budgetCategories, group, []).push(category);
  }
  return groupedCategories;
}
