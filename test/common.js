const assert = require('assert');
const orm = require('../lib/orm');
const options = {
    foo: "foo",
    debugTestTable: undefined,
    debugTestTable0: undefined,
    debugTestTable1: undefined,
};

const MAX_LEN = 100; // how many times do we try these random tests?

function randomStr() {
    const length = 8;
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

function randomInt(minInt = -2147483648, maxInt = 2147483647) {
    return parseFloat(Math.floor((Math.random() * (maxInt - minInt)) + minInt));
}

async function sqlDoesTableExist(tableName) {
    const res = await orm.adminQuery(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = "${tableName}"`);
    return res.length !== 0;
}
async function sqlDoesColumnNameExistInTable(tableName, columnName) {
    if (!(await sqlDoesTableExist(tableName))) {
        return false;
    }
    const res = await orm.adminQuery(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = "${tableName}"`);
    for (let i = 0; i < res.length; i++) {
        const resEntry = res[i];
        if (resEntry.COLUMN_NAME === columnName) {
            return true;
        }
    }
    return false;
}

async function sqlIsColumnRightDataType(tableName, columnName, expectedDataType, expectedCharacterMaximumLength) {
    if (!(await sqlDoesTableExist(tableName))) {
        return false;
    }
    const res = await orm.adminQuery(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = "${tableName}"`);
    for (let i = 0; i < res.length; i++) {
        const resEntry = res[i];
        if (resEntry.COLUMN_NAME === columnName) {
            if (resEntry.DATA_TYPE === expectedDataType) {
                if (resEntry.CHARACTER_MAXIMUM_LENGTH === expectedCharacterMaximumLength) {
                    return true;
                }
            }
        }
    }
    return false;
}

module.exports = {
    options,
    assert,
    orm,
    MAX_LEN,
    randomStr,
    randomInt,
    sqlDoesTableExist,
    sqlDoesColumnNameExistInTable,
    sqlIsColumnRightDataType,
}