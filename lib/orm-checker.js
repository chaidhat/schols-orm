const ormSql = require("./orm-sql");
const ormHelper = require("./orm-helper");

var databaseTables = []
var areAllTablesValid = false;

module.exports.getValidity = getValidity;
function getValidity() {
    return areAllTablesValid;
}

module.exports.findTable = findTable;
function findTable(tableName) {
    // TODO: make O(1). not O(N)
    return databaseTables.find((dt) => dt.tableName === tableName);
}

// call only ONCE per table on init
// this is done at compiletime
module.exports.pushTable = pushTable;
async function pushTable(table) {
    if (areAllTablesValid) {
        areAllTablesValid = false;
    }
    databaseTables.push(table);
}

module.exports.popTable = popTable;
async function popTable(table) {
    for (let i = 0; i < databaseTables.length; i++) {
        if (databaseTables[i].tableName === table.tableName) {
            databaseTables.splice(i, 1);
            return;
        }
    }
}

// this is called for when a sqlQuery is made.
// this is done at runtime
// NOTE: sqlQueries are NOT made for table definees nor inits.
module.exports.validateAllTables = validateAllTables;
async function validateAllTables() {
    await _checkTableDbConsistency();
    _checkTableNames();
    _checkTableDuplicates();
    _checkTablesForCycles();
    _checkTableProperties();
    areAllTablesValid = true;
}

function _checkTableNames() {
    for (let i = 0; i < databaseTables.length; i++) {
        const match = databaseTables[i].tableName.match(/^[a-zA-Z0-9]+$/);
        if (match === null) {
            throw `orm fatal: table name ${property.name} must not contain any special characters. Use CamelCase for table names.`;
        }
        const match2 = databaseTables[i].tableKeyName.match(/^[a-zA-Z0-9]+$/);
        if (match2 === null) {
            throw `orm fatal: table key name ${property.name} must not contain any special characters. Use pascalCase for table key values.`;
        }
        for (let j = 0; j < databaseTables[i].properties.length; j++) {
            const property = databaseTables[i].properties[j];
            const match = property.name.match(/^[a-zA-Z0-9]+$/);
            if (match === null) {
                throw `orm fatal: property ${property.name} must not contain any special characters. Use pascalCase for property names.`;
            }
        }
    }
}


async function _checkTableDbConsistency() {
    for (let i = 0; i < databaseTables.length; i++) {
        const databaseTable = databaseTables[i];
        const resPromise = await ormSql.sqlQuery(`SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = "${databaseTable.tableName}"`, true, true);
        const res = await resPromise;

        if (res.length === 0) {
            console.log(`orm warning: cannot find ${databaseTable.tableName} in database.`);
            continue;
        }

        // set up data
        let columns = [];
        let dataTypeMap = {};
        for (let j = 0; j < res.length; j++) {
            const resEntry = res[j];
            columns.push(resEntry.COLUMN_NAME);
            if (resEntry.DATA_TYPE === "varchar") {
                dataTypeMap[resEntry.COLUMN_NAME] = `${resEntry.DATA_TYPE}(${resEntry.CHARACTER_MAXIMUM_LENGTH})`;
            } else {
                dataTypeMap[resEntry.COLUMN_NAME] = resEntry.DATA_TYPE;
            }
        }

        // tableKey
        if (!columns.includes(databaseTable.tableKeyName)) {
            console.log(`orm fatal: cannot find '${databaseTable.tableName}.${databaseTable.tableKeyName}' in database.`);
        } else {
            const index = columns.indexOf(databaseTable.tableKeyName);
            if (index > -1) { // only splice array when item is found
                columns.splice(index, 1); // 2nd parameter means remove one item only
            }
        }
        if ("int" !== dataTypeMap[databaseTable.tableKeyName]) {
            console.log(`orm fatal: schema '${databaseTable.tableName}.${databaseTable.tableKeyName}' has type 'int' but in db it has type '${resEntry.DATA_TYPE}'`);
        }

        // properties
        for (let j = 0; j < databaseTable.properties.length; j++) {
            const column = databaseTable.properties[j];
            if (!columns.includes(column.name)) {
                if (ormHelper.isTokenPrimitive(column.type)) {
                    // primitives require row in db
                    console.log(`orm fatal: cannot find schema row '${databaseTable.tableName}.${column.name}' in database.`);
                }
            } else {
                const index = columns.indexOf(column.name);
                if (index > -1) { // only splice array when item is found
                    columns.splice(index, 1); // 2nd parameter means remove one item only
                }
            }
            if (column.type !== dataTypeMap[column.name]) {
                if (ormHelper.isTokenPrimitive(column.type)) {
                    // primitives require correct type in db
                    console.log(`orm fatal: '${databaseTable.tableName}.${column.name}' has type '${column.type}' but in db it has type '${dataTypeMap[column.name]}'`);
                }
            }
        }

        // excess properties
        if (columns.length > 0) {
            console.log(`orm warning: schema is inconsistent with actual db. ${databaseTable.tableName} has columns [${columns}] in db which were not specified in schema.`);
        }
    }
}

function _checkTableDuplicates() {
    for (let i = 0; i < databaseTables.length; i++) {
        for (let j = 0; j < databaseTables.length; j++) {
            if (databaseTables[i].tableName === databaseTables[j].tableName && i !== j) {
                throw `orm fatal: duplicate table name ${databaseTables[i].tableName}`;
            }
            if (databaseTables[i].tableKeyName === databaseTables[j].tableKeyName && i !== j) {
                throw `orm fatal: duplicate table key name ${databaseTables[i].tableKeyName}`;
            }
        }
    }
}

function _checkTablesForCycles() {
    for (let i = 0; i < databaseTables.length; i++) {
        const tableKeyName = databaseTables[i].tableKeyName;
        for (let j = 0; j < databaseTables.length; j++) {
            if (i === j) { 
                continue;
            }
            for (let k = 0; k < databaseTables[j].properties.length; k++) {
                if (databaseTables[j].properties[k].name === tableKeyName) {
                    // if cyceTableMemory[j] contains tableKeyName in property, cycleTableMemory[i] should not contain cyceTableMemory[j]'s tablekeyname in their table
                    for (let l = 0; l < databaseTables[i].properties.length; l++) {
                        if (databaseTables[i].properties[l].name === databaseTables[j].tableKeyName) {
                            throw `orm fatal: dependency detected! ${databaseTables[i].tableName} and ${databaseTables[j].tableName}`;
                        }
                    }

                }
            }
        }
    }
}

function _checkTableProperties() {
    databaseTables.forEach((databaseTable) => {
        databaseTable.properties.forEach((property) => {
            const propertyType = ormHelper.parseType(property.type);

            if (ormHelper.isTokenPrimitive(propertyType.dataType)) {
                if (propertyType.dataType === "varchar") {
                    if (propertyType.precision === null) {
                        throw `orm fatal: type error '${property.name}': varchar precision is required`;
                    }
                } else {
                    if (propertyType.precision !== null) {
                        throw `orm fatal: type error '${property.name}': unexpected precision value (only varchars can have precision)`;
                    }
                }
                if (propertyType.isArray) {
                    throw `orm fatal: type error '${property.name}': array of primitives not supported yet!`;
                    // TODO: implement
                }
                return; // OK
            }

            const dependentDatabaseTable = databaseTables.find((dt) => dt.tableName === propertyType.dataType);
            if (dependentDatabaseTable !== undefined) {
                if (propertyType.precision !== null) {
                    throw `orm fatal: type error '${property.name}': unexpected precision value (only varchars can have precision)`;
                }
                if (propertyType.isArray) {
                    // 1-M connection
                    // assert that that database contains a key with the id of this table
                    // i.e.,
                    // table A { int tableAId, int a, tableBId b }, then
                    // table B MUST contain tableAId to form a 1-M connection.
                    const dependentDatabaseTableProperty = dependentDatabaseTable.properties.find((p) => p.name === databaseTable.tableKeyName);
                    if (dependentDatabaseTableProperty === undefined) {
                        throw `orm fatal: type error '${property.name}': 1-M fail: table '${dependentDatabaseTable.tableName}' must contain 'int ${databaseTable.tableKeyName}' as property`;
                    }
                } else {
                    // 1-1 connection
                    throw `orm fatal: type error '${property.name}': 1-1 fail: non-primitives as non-arrays are not supported yet!`;
                    // TODO: implement
                }
                return; // OK
            }
            throw `orm fatal: type error '${property.name}': unknown type`;

        });
    });
}