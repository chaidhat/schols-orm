
import ormChecker from "./orm-checker";
import ormSql from "./orm-sql";
import ormHelper from "./orm-helper";
import ormTable from "./orm-table";

// for admin usage only
async function adminQuery(queryStr, errorQuietly = false) {
    return await ormSql.sqlQuery(queryStr, errorQuietly);
}

module.exports = Object.assign({adminQuery}, ormChecker, ormSql, ormHelper, ormTable)