
const ormChecker = require("./checker");
const ormSql = require("./sql");
const ormHelper = require("./helper");
const ormTable = require("./table");

// for admin usage only
async function adminQuery(queryStr, errorQuietly = false) {
    return await ormSql.sqlQuery(queryStr, errorQuietly);
}

module.exports = Object.assign({adminQuery}, ormChecker, ormSql, ormHelper, ormTable)