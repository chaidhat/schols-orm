
import ormChecker from "./orm-checker.js";
import ormSql from "./orm-sql.js";
import ormHelper from "./orm-helper.js";
import DatabaseTable from "./orm-table.js";

// for admin usage only
async function adminQuery(queryStr, errorQuietly = false) {
    return await ormSql.sqlQuery(queryStr, errorQuietly);
}

// Export DatabaseTable directly rather than trying to spread properties of a class
export default Object.assign({adminQuery, DatabaseTable}, ormChecker, ormSql, ormHelper);