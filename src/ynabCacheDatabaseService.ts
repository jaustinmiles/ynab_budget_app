import { createYnabApi } from './ynabService';
import { Database, verbose } from 'sqlite3';

const sqlite3 = verbose();

export enum CacheFunctions {
  GET_MONTH_CATEGORY_BY_ID,
  GET_BUDGET_BY_ID,
  GET_MONTH_TRANSACTION_BY_ID,
}

export type DbCacheEntry = {
  last_requested: number;
  response: never;
};

export class YnabCacheDatabaseService {
  private static db: Database;

  public static destruct() {
    YnabCacheDatabaseService.db.close();
  }

  public static getDb(): Database {
    if (!YnabCacheDatabaseService.db) {
      YnabCacheDatabaseService.db = createOrInitializeDb();
    }
    return YnabCacheDatabaseService.db;
  }
}

function createOrInitializeDb() {
  const ynabUri = process.env.YNAB_API_CACHE_DATABASE_URI;
  if (!ynabUri) {
    throw new Error('Missing YNAB_API_CACHE_DATABASE_URI environment variable');
  }
  const db = new sqlite3.Database(ynabUri);

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS api_cache
                (
                    params
                    TEXT
                    PRIMARY
                    KEY,
                    response
                    TEXT,
                    last_requested
                    INTEGER
                )`);
  });
  return db;
}

export async function getCachedYnabResponse(
  params: string[],
  cacheFunction: CacheFunctions,
) {
  const db = YnabCacheDatabaseService.getDb();
  const paramsString = JSON.stringify(params);
  let updateNeeded = false;
  const response = await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get(
        `SELECT response, last_requested
                    FROM api_cache
                    WHERE params = ?`,
        [paramsString],
        (err: never, row: DbCacheEntry) => {
          if (err) {
            reject(err);
          }
          const cacheEntryRow = row as DbCacheEntry;
          const currentTime = new Date().getTime();
          const oneHour = 60 * 60 * 1000;
          if (
            cacheEntryRow &&
            currentTime - cacheEntryRow.last_requested < oneHour
          ) {
            // TODO: implement standardized logging
            console.log('API response cached, returning from cache');
            return resolve(JSON.parse(row.response));
          }

          try {
            updateNeeded = true;
            const ynabApi = createYnabApi();
            console.log('API response not cached, fetching from YNAB API');
            switch (cacheFunction) {
              case CacheFunctions.GET_BUDGET_BY_ID: {
                const budget = ynabApi.budgets.getBudgetById(params[0]);
                return resolve(budget);
              }
              case CacheFunctions.GET_MONTH_CATEGORY_BY_ID: {
                const category = ynabApi.categories.getMonthCategoryById(
                  params[0],
                  params[1],
                  params[2],
                );
                return resolve(category);
              }
              case CacheFunctions.GET_MONTH_TRANSACTION_BY_ID: {
                const transactions =
                  ynabApi.transactions.getTransactionsByMonth(
                    params[0],
                    params[1],
                  );
                return resolve(transactions);
              }
            }
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  });
  if (response) {
    const responseData = JSON.stringify(response);
    const timestamp = Date.now();
    if (updateNeeded) {
      db.serialize(() => {
        db.run(
          'INSERT OR REPLACE INTO api_cache ' +
            '(params, response, last_requested) VALUES (?, ?, ?)',
          [paramsString, responseData, timestamp],
          (err: { message: never }) => {
            if (err) {
              throw new Error('Error inserting into cache' + err.message);
            }
            console.log('API response cached');
          },
        );
      });
    }
  }
  return response;
}
