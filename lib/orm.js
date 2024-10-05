
const ormChecker = require("./orm-checker");
const ormSql = require("./orm-sql");
const ormHelper = require("./orm-helper");
const ormTable = require("./orm-table");

// for admin usage only
async function adminQuery(queryStr, errorQuietly = false) {
    return await ormSql.sqlQuery(queryStr, errorQuietly);
}

module.exports = Object.assign({adminQuery}, ormChecker, ormSql, ormHelper, ormTable)