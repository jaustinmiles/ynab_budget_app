import * as ynab from 'ynab';

export interface ICategoryMap {
  budgetCategories: Map<string, Array<ynab.Category>>;
}

export interface ICategories {
  budgetId: string;
  budgetCategories: Array<ynab.Category>;
}

export interface IGroupedCategories {
  budgetId: string;
  budgetCategories: Map<string, Array<ynab.Category>>;
}

export type YnabCategoryGroupMap = {
  [budgetKey: string]: {
    [budgetId: string]: Array<string>;
  };
};
