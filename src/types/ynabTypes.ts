import * as ynab from 'ynab';

export interface IYnabBudget {
    id: string,
    name: string,
    last_modified_on: string,
}

export interface ICategoryMap {
    budgetCategories: Map<string, Array<ynab.Category>>
}