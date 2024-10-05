const fs = require('node:fs');

const ormChecker = require("./orm-checker");
const ormSql = require("./orm-sql");
const ormHelper = require("./orm-helper");
const { table } = require('node:console');

// clear crud file
fs.writeFile('crud', "", err => {
    if (err) {
        console.error(err);
    } else {
        // file written successfully
    }
});

class DatabaseTable {
    tableName;
    tableKeyName;
    properties;
    nameToPropertyMap; // maps property names to properties
    childTables = [];

    constructor(tableName, tablePrivateKeyName, properties) {
        this.tableName = tableName;
        this.tableKeyName = tablePrivateKeyName;
        this.properties = properties;
        this.nameToPropertyMap = {};
        for (let i = 0; i < properties.length; i++) {
            if (this.nameToPropertyMap[properties[i].name] !== undefined) {
                const err = `orm fatal: cannot have duplicate property names`;
                ormHelper.logError(err);
                throw err;
            }
            this.nameToPropertyMap[properties[i].name] = properties[i];
        }
        this.childTables = [];

        // validate the table
        ormChecker.pushTable(this);
    }

    // O(1)
    getPropertyType(propertyName) {
        if (this.nameToPropertyMap[propertyName] !== undefined) {
            return this.nameToPropertyMap[propertyName].type;
        } else if (this.tableKeyName === propertyName) {
            return "int";
        } else {
            const err = `orm fatal: cannot getPropertyType of property '${propertyName}' because it is not in table.`;
            ormHelper.logError(err);
            throw err;
        }
    }

    async getNextKey() {
        let queryStr = `SELECT MAX(${this.tableKeyName}) AS id_max FROM ${this.tableName}`;
        let result = await this.query(queryStr);
        result = result[0]; // get the first result

        // incase if no elements existed previously
        if (result.id_max === null) {
            result.id_max = 0;
        }

        return result.id_max + 1;
    }

    async init() {
        let queryStr = `CREATE TABLE IF NOT EXISTS ${this.tableName} (`;
        // format for table key
        queryStr += `${this.tableKeyName} int, `;

        // format name:type
        this.properties.forEach((property, index, arr) => {
            const propertyType = ormHelper.parseType(property.type);
            if (!ormHelper.isTokenPrimitive(propertyType.dataType)) {
                return; // do not initialize non primitives
            }
            queryStr += `${property.name} ${property.type}, `;
        });
        // remove the , at the end
        queryStr = queryStr.substring(0, queryStr.length - 2);

        queryStr += ');';
        await ormSql.sqlQuery(queryStr, false, true);
    }

    async query(queryStr) {
        return await ormSql.sqlQuery(queryStr, false);
    }


    // drop table
    async drop() {
        /*let queryStr = `DROP TABLE ${this.tableName};`;
        await this.query(queryStr);*/
        ormChecker.popTable(this);
    }

    async select(where, options) {
        // parse options
        // for backwards compatibility, TODO: refactor code to make this unused.
        if (options !== undefined) {
            if (typeof options === "string") {
                let s = options;
                options = {suffix: s};
            }
        }
        const hasIncludes = options !== undefined && options.include !== undefined;
        const hasSuffix = options !== undefined && options.suffix !== undefined;
        const hasWhere = where !== undefined && where !== null;


        // SELECT
        let queryStr = `SELECT\n`;
        let queryStrIncludes = ``;
        let selectColumns = [];
        selectColumns.push(`${this.tableName}.${this.tableKeyName}`);
        for (let i = 0; i < this.properties.length; i++) {
            const property = this.properties[i];
            const propertyType = ormHelper.parseType(property.type);
            if (ormHelper.isTokenPrimitive(propertyType.dataType)) {
                if (propertyType.isArray) {
                    // NOT implemented
                    throw `not implemented`;
                } else {
                    selectColumns.push(`${this.tableName}.${this.properties[i].name}`);
                }
            } else {
                const dependentTable = ormChecker.findTable(propertyType.dataType);
                if (propertyType.isArray) {
                    selectColumns.push(`${dependentTable.tableName}.${dependentTable.tableKeyName} AS ${property.name}_${dependentTable.tableKeyName}`);
                    for (let j = 0; j < dependentTable.properties.length; j++) {
                        selectColumns.push(`${dependentTable.tableName}.${dependentTable.properties[j].name} AS ${property.name}_${dependentTable.properties[j].name}`);
                    }
                    queryStrIncludes += ` LEFT OUTER JOIN ${dependentTable.tableName} ON ${this.tableName}.${this.tableKeyName} = ${dependentTable.tableName}.${this.tableKeyName}\n`;
                    // don't do anything
                } else {
                    // NOT implemented
                    throw `not implemented`;
                }
            }
        }

        // FROM
        queryStr += `    ${selectColumns.join(", \n    ")}\n`;
        queryStr += `FROM ${this.tableName} \n`;
        queryStr += queryStrIncludes;

        // WHERE
        if (hasWhere) {
            let queryStrWheres = [];
            for (const propertyName in where) {
                const propertyValue = where[propertyName];
                const propertyType = this.getPropertyType(propertyName);

                if (!Array.isArray(propertyValue) || propertyValue === null) {
                    // for e.g., SELECT * FROM table WHERE name = 1
                    // input: {name: 1}

                    ormHelper.assertType(propertyName, propertyValue, propertyType);
                    queryStrWheres.push(`${this.tableName}.${propertyName} = ${ormHelper.sanitizeSqlValue(propertyValue)}`);
                } else {
                    // for e.g., SELECT * FROM table WHERE name IN (1, 2, 3)
                    // input: {name: [1, 2, 3]}

                    // if the value is just an empty array
                    if (propertyValue.length === 0) {
                        return [];
                    }

                    let wheres = [];
                    for (let i = 0; i < propertyValue.length; i++) {
                        const singlePropertyValue = propertyValue[i];
                        ormHelper.assertType(propertyName, singlePropertyValue, propertyType);
                        wheres.push(ormHelper.sanitizeSqlValue(singlePropertyValue));
                    }
                    
                    queryStrWheres.push(`${this.tableName}.${propertyName} IN (${wheres.join(", ")})`);
                    continue;
                }
            }
            queryStr += ` WHERE ${queryStrWheres.join(" AND ")}`
        }

        // optional additional suffix
        if (hasSuffix) {
            // todo: make sure suffix is clean!
            queryStr += ` ${options.suffix}`;
        }

        // execute
        queryStr += ";";
        let output = await this.query(queryStr);
        // e.g. output = [
        //      {aId: 1, a: 124, b: "abc", d_dId: 7, d_da: 123, d_db: "a", e_eId: 3, e_ea: 245},
        //      {aId: 1, a: 124, b: "abc", d_dId: 8, d_da: 900, d_db: "f", e_eId: null, e_ea: null},
        //      {aId: 2, a: 800, b: "qrs", d_dId: 10, d_da: 560, d_db: "u", e_eId: null, e_ea: null}
        // ]

        // format
        // create an outputMap
        // outputMap maps rowKey -> { properties of this table's rowKey }
        // e.g. outputMap = {
        //      1: {
        //          aId: 1,
        //          a: 124,
        //          b: "abc",
        //          d: {
        //              7: {dId: 7, da: 123, db: "a"}
        //              8: {dId: 7, da: 123, db: "a"}
        //          },
        //          e: {
        //              3: {eId: 3, ea: 245}
        //          }
        //      },
        //      2: {
        //          aId: 2,
        //          a: 800
        //          b: "qrs"
        //          d: {
        //              10: {dId: 10, da: 560, db: "u"}
        //          },
        //          e: {}
        //      },
        // }
        let outputMap = {};
        for (let i = 0; i < output.length; i++) {
            // get the output row
            // e.g. outputRow = {aId: 1, a: 124, b: "abc", d_dId: 7, d_da: 123, d_db: "a", e_eId: 3, e_ea: 245},
            const outputRow = output[i];
            // get the tableKey's value for reference
            const tableKeyValue = outputRow[this.tableKeyName];

            if (outputMap[tableKeyValue] === undefined) {
                outputMap[tableKeyValue] = {};
            }

            // go through all pairs in outputRow
            // e.g. (a, 124)
            let dependentTablesToProperties = {};
            Object.keys(outputRow).forEach((propertyName) => {
                const propertyValue = outputRow[propertyName];
                const propertyNameSplit = propertyName.split("_");

                // outputMap maps dependentRowKey -> { properties of this table's rowKey }
                if (propertyNameSplit.length > 1) {
                    // this means that the property belongs to the include table
                    // this belongs to a different table
                    // e.g. for 3rd index in {aId: 1, a: 124, b: "abc", d_dId: 7, d_da: 123, d_db: "a", e_eId: 3, e_ea: 245}
                    //      propertyValue = 123
                    //      propertyName = "d_da"
                    //      dependentTableName = "d"
                    //      dependentPropertyName = "da"
                    const dependentTableName = propertyNameSplit[0];
                    const dependentPropertyName = propertyNameSplit[1];

                    // copy it to a map, indexed by the tableName
                    // e.g. dependentTablesToProperties = {
                    //      "d": {"dId": 7, "da": 123, "db": "a"},
                    //      "e": {"eId": 3, "ea": 245}
                    // }
                    if (dependentTablesToProperties[dependentTableName] === undefined) {
                        dependentTablesToProperties[dependentTableName] = {};
                    }
                    if (propertyValue !== null) {
                        dependentTablesToProperties[dependentTableName][dependentPropertyName] = propertyValue;
                    }
                } else {
                    // this means that the property belongs to this table
                    // e.g. for 1st index in {aId: 1, a: 124, b: "abc", d_dId: 7, d_da: 123, d_db: "a", e_eId: 3, e_ea: 245}
                    //      propertyValue = 124
                    //      propertyName = "a"
                    outputMap[tableKeyValue][propertyName] = propertyValue;
                }
            });
            // finished going through all pairs in outputRow
            // insert dependentOutputMap into outputMap
            Object.keys(dependentTablesToProperties).forEach((dependentTableName) => {
                // e.g.
                //      dependentTableName = "d"
                //      dependentTableValue = {"dId": 7, "da": 123, "db": "a"},
                //      dependentTableKeyName = "dId"
                const dependentTableValue = dependentTablesToProperties[dependentTableName];
                if (outputMap[tableKeyValue][dependentTableName] === undefined) {
                    outputMap[tableKeyValue][dependentTableName] = {};
                }
                if (Object.keys(dependentTableValue).length === 0) {
                    return; // skip
                }
                const tableType = ormHelper.parseType(this.getPropertyType(dependentTableName)).dataType
                const dependentTableKeyName = (ormChecker.findTable(tableType)).tableKeyName;

                // e.g.
                // inserts into 2: { a: 2, b: "abc", d: {<INSERT HERE>, ...} }
                //              7: {dId: 7, da: 123, db: "a"}
                // this overwrites duplicates too which is helpful
                // O(1)
                if (dependentTableValue[dependentTableKeyName] === undefined) {
                    const err = `orm fatal: dependent table's key '${dependentTableKeyName}' is expected in output of the INNER JOIN's '${dependentTableValue}'`;
                    ormHelper.logError(err);
                    throw err;
                }
                outputMap[tableKeyValue][dependentTableName][dependentTableValue[dependentTableKeyName]] = dependentTableValue;
            });
        }
        // convert output map to output
        // depth 1
        let newOutput = [];
        Object.keys(outputMap).forEach((kv) => {
            // depth 2
            // e.g.
            // outputMap[kv] =
            //      {
            //          aId: 1,
            //          a: 124,
            //          b: "abc",
            //          d: {
            //              7: {dId: 7, da: 123, db: "a"}
            //              8: {dId: 7, da: 123, db: "a"}
            //          },
            //          e: {
            //              3: {eId: 3, ea: 245}
            //          }
            //      }
            Object.keys(outputMap[kv]).forEach((kvkv) => {
            // e.g.
            // outputMap[kv][kvkv] =
            //          d: {
            //              7: {dId: 7, da: 123, db: "a"}
            //              8: {dId: 7, da: 123, db: "a"}
            //          },
                const kvkvType = ormHelper.parseType(this.getPropertyType(kvkv))
                if (!ormHelper.isTokenPrimitive(kvkvType.dataType)) {
                    let o = [];
                    if (outputMap[kv][kvkv] === null || outputMap[kv][kvkv] === undefined) {
                        return;
                    }
                    Object.keys(outputMap[kv][kvkv]).forEach((kvkvkv) => {
                        o.push(outputMap[kv][kvkv][kvkvkv]);
                    });
                    outputMap[kv][kvkv] = o;
                }
                
            });
            newOutput.push(outputMap[kv]);
        });
        output = newOutput;

        return output;
    }

    async selectMax(columnName, where) {
        let queryStr = `SELECT MAX(${columnName}) AS ${columnName} FROM ${this.tableName}`;
        if (where !== undefined) {
            let queryStrWheres = "";
            for (const propertyName in where) {
                const propertyValue = where[propertyName];
                const propertyType = this.getPropertyType(propertyName);

                ormHelper.assertType(propertyName, propertyValue, propertyType);
                queryStrWheres += `${propertyName} = ${ormHelper.sanitizeSqlValue(propertyValue)} AND `;
            }
            // remove the AND at the end
            queryStrWheres = queryStrWheres.substring(0, queryStrWheres.length - 5);
            queryStr += ` WHERE ${queryStrWheres}`
        }
        queryStr += ";";
        return (await this.query(queryStr))[0];
    }

    async insertInto(entry) {
        if (entry === null) {
            const err = `orm fatal: 'entry' clause not provided in insert()`;
            ormHelper.logError(err);
            throw err;
        }

        // NOTE: because of nextKey and getNextKey, this is causing this operation to be O(N) not O(1)
        const nextKey = await this.getNextKey();
        let queryStrCol = [this.tableKeyName];
        let queryStrVal = [nextKey];

        for (const propertyName in entry) {
            const propertyValue = entry[propertyName];
            const propertyType = ormHelper.parseType(this.getPropertyType(propertyName));

            // check array
            if (propertyType.isArray) {
                if (!Array.isArray(propertyValue)) {
                    const err = `orm fatal: expected array for value '${propertyName}' in table '${this.tableName}'`;
                    ormHelper.logError(err);
                    throw err;
                } 
            } else {
                if (Array.isArray(propertyValue)) {
                    const err = `orm fatal: expected not array for value '${propertyName}' in table '${this.tableName}'`;
                    ormHelper.logError(err);
                    throw err;
                } 
            }

            if (ormHelper.isTokenPrimitive(propertyType.dataType)) {
                // e.g. insertInto({a: 123})
                if (propertyType.isArray) {
                    throw `not implemented!`
                    // TODO: implement
                } else {
                    ormHelper.assertType(propertyName, propertyValue, propertyType.dataType);
                    queryStrCol.push(`${propertyName}`);
                    queryStrVal.push(`${ormHelper.sanitizeSqlValue(propertyValue)}`)
                }
            } else {
                if (propertyType.isArray) {
                    // insert a 1-M function
                    // e.g. insertInto({posts: [{a: 2, b: c}]})
                    const dependentTable = ormChecker.findTable(propertyType.dataType);
                    for (let i = 0; i < propertyValue.length; i++) {
                        const propertyValueChild = propertyValue[i];
                        const dependentInsertIntoMap = {};
                        for (const [key, value] of Object.entries(propertyValueChild)) {
                            dependentInsertIntoMap[key] = value;
                        }
                        dependentInsertIntoMap[this.tableKeyName] = nextKey;
                        await dependentTable.insertInto(dependentInsertIntoMap);
                    }
                } else {
                    // insert a 1-1 function
                    // e.g. insertInto({post: {a: 2, b: c}})
                    throw `not implemented!`
                    // TODO: implement
                }
            }

        }

        const queryStr = `INSERT INTO ${this.tableName} (${queryStrCol.join(", ")}) VALUES (${queryStrVal.join(", ")});`;
        await this.query(queryStr);
        return nextKey;
    }

    async update(where, entry) {
        if (where === undefined || where === null) {
            const err = `orm fatal: 'where' clause not provided in update()`;
            ormHelper.logError(err);
            throw err;
        }
        if (entry === undefined || entry === null) {
            const err = `orm fatal: 'entry' clause not provided in update()`;
            ormHelper.logError(err);
            throw err;
        }
        if (Object.keys(where).length === 0) {
            const err = `orm fatal: 'where' clause must not be empty.`
            ormHelper.logError(err);
            throw err;
        }
        if (Object.keys(entry).length === 0) {
            return; // if there are no entries to update, there is nothing to update.
        }

        let queryStrWheres = [];
        for (const propertyName in where) {
            const propertyValue = where[propertyName];
            const propertyType = ormHelper.parseType(this.getPropertyType(propertyName));

            // check array
            if (propertyType.isArray) {
                if (!Array.isArray(propertyValue)) {
                    const err = `orm fatal: expected array for value '${propertyName}' in table '${this.tableName}'`;
                    ormHelper.logError(err);
                    throw err;
                } 
            } else {
                if (Array.isArray(propertyValue)) {
                    const err = `orm fatal: expected not array for value '${propertyName}' in table '${this.tableName}'`;
                    ormHelper.logError(err);
                    throw err;
                } 
            }

            if (ormHelper.isTokenPrimitive(propertyType.dataType)) {
                if (propertyType.isArray) {
                    throw `not implemented!`
                    // TODO: implement
                } else {
                    ormHelper.assertType(propertyName, propertyValue, propertyType.dataType);
                    queryStrWheres.push(`${this.tableName}.${propertyName} = ${ormHelper.sanitizeSqlValue(propertyValue)}`);
                }
            } else {
                throw `not implemented!`
                // TODO: implement
            }

        }

        let queryStrEntries = [];
        for (const propertyName in entry) {
            const propertyValue = entry[propertyName];
            const propertyType = ormHelper.parseType(this.getPropertyType(propertyName));

            // check array
            if (propertyType.isArray) {
                if (!Array.isArray(propertyValue)) {
                    const err = `orm fatal: expected array for value '${propertyName}' in table '${this.tableName}'`;
                    ormHelper.logError(err);
                    throw err;
                } 
            } else {
                if (Array.isArray(propertyValue)) {
                    const err = `orm fatal: expected not array for value '${propertyName}' in table '${this.tableName}'`;
                    ormHelper.logError(err);
                    throw err;
                } 
            }

            if (ormHelper.isTokenPrimitive(propertyType.dataType)) {
                if (propertyType.isArray) {
                    throw `not implemented!`
                    // TODO: implement
                } else {
                    ormHelper.assertType(propertyName, propertyValue, propertyType.dataType);
                    queryStrEntries.push(`${propertyName} = ${ormHelper.sanitizeSqlValue(propertyValue)}`);
                }
            } else {
                if (propertyType.isArray) {
                    // insert a 1-M function
                    // e.g. update({ ... }, {posts: [{a: 2, b: c}]})
                    const dependentTable = ormChecker.findTable(propertyType.dataType);

                    // note: this costs a O(1) SELECT, O(M) DELETES and O(M x N) INSERTS, is this efficient?
                    // M is the number of affected tables, N is the number of properties
                    const affectedTables = await this.select(where);
                    for(let j = 0; j < affectedTables.length; j++) {
                        const affectedTable = affectedTables[j]
                        const deleteWhere = {};
                        deleteWhere[this.tableKeyName] = affectedTable[this.tableKeyName];
                        await dependentTable.deleteFrom(deleteWhere);

                        for (let i = 0; i < propertyValue.length; i++) {

                            const propertyValueChild = propertyValue[i];
                            const dependentInsertIntoMap = {};
                            for (const [key, value] of Object.entries(propertyValueChild)) {
                                dependentInsertIntoMap[key] = value;
                            }
                            dependentInsertIntoMap[this.tableKeyName] = affectedTable[this.tableKeyName];
                            await dependentTable.insertInto(dependentInsertIntoMap);
                        }
                    }
                } else {
                    // insert a 1-1 function
                    // e.g. update({ .. }, {post: {a: 2, b: c}})
                    throw `not implemented!`
                    // TODO: implement
                }
            }
        }

        const queryStr = `UPDATE ${this.tableName} SET ${queryStrEntries.join(", ")} WHERE ${queryStrWheres.join(" AND ")};`;
        await this.query(queryStr);
    }

    async deleteFrom(where) {
        if (where === undefined || where === null) {
            const err = `orm fatal: 'where' clause not provided in update()`;
            ormHelper.logError(err);
            throw err;
        }

        let queryStrWheres = [];
        for (const propertyName in where) {
            const propertyValue = where[propertyName];
            const propertyType = ormHelper.parseType(this.getPropertyType(propertyName));

            // check array
            if (propertyType.isArray) {
                if (!Array.isArray(propertyValue)) {
                    const err = `orm fatal: expected array for value '${propertyName}' in table '${this.tableName}'`;
                    ormHelper.logError(err);
                    throw err;
                } 
            } else {
                if (Array.isArray(propertyValue)) {
                    const err = `orm fatal: expected not array for value '${propertyName}' in table '${this.tableName}'`;
                    ormHelper.logError(err);
                    throw err;
                } 
            }

            if (ormHelper.isTokenPrimitive(propertyType.dataType)) {
                if (propertyType.isArray) {
                    throw `not implemented!`
                    // TODO: implement
                } else {
                    ormHelper.assertType(propertyName, propertyValue, propertyType.dataType);
                    queryStrWheres.push(`${this.tableName}.${propertyName} = ${ormHelper.sanitizeSqlValue(propertyValue)}`);
                }
            } else {
                throw `not implemented!`
                // TODO: implement
            }

        }

        for (let i = 0; i < this.properties.length; i++) {
            const propertyType = ormHelper.parseType(this.getPropertyType(this.properties[i].name));
            if (ormHelper.isTokenPrimitive(propertyType.dataType)) {
            } else {
                if (propertyType.isArray) {
                    // insert a 1-M function
                    // e.g. update({ ... }, {posts: [{a: 2, b: c}]})
                    const dependentTable = ormChecker.findTable(propertyType.dataType);

                    const deleteQueryStr = `
                    DELETE ${dependentTable.tableName}
                    FROM ${dependentTable.tableName}
                    INNER JOIN ${this.tableName}
                    ON ${this.tableName}.${this.tableKeyName} = ${dependentTable.tableName}.${this.tableKeyName} 
                    WHERE ${queryStrWheres.join(" AND ")};`;
                    await this.query(deleteQueryStr);
                } else {
                    throw `not implemented!`
                    // TODO: implement
                }
            }
        }
        let queryStr = `DELETE FROM ${this.tableName} WHERE ${queryStrWheres.join(" AND ")}`;
        await this.query(queryStr);
    }

    async generateCode(tableIdentifier) {
        let propertyNameList = [];
        for (let i = 0; i < this.properties.length; i++) {
            propertyNameList.push(this.properties[i].name);
        }
        const propertyNameListStr = propertyNameList.join(", \n");

        let propertyListMap = [];
        for (let i = 0; i < this.properties.length; i++) {
            propertyListMap.push(`${this.properties[i].name}: ${this.properties[i].name}`)
        }
        const propertyNameMapStr = propertyListMap.join(", \n");
        const content = `
// CRUD
// get
module.exports.get${this.tableName} = get${this.tableName};
async function get${this.tableName} (token, ${this.tableKeyName}) {
    //TODO: auth
    const data = await ${tableIdentifier}.select({${this.tableKeyName}});
    return data;
}

// create
module.exports.create${this.tableName} = create${this.tableName};
async function create${this.tableName} (
    token, 
    ${propertyNameListStr}
) {
    //TODO: auth
    // create 
    const ${this.tableKeyName} = await ${tableIdentifier}.insertInto({
        ${propertyNameMapStr}
    });
    return ${this.tableKeyName};
}

// change
module.exports.change${this.tableName} = change${this.tableName};
async function change${this.tableName} (
    token, 
    ${this.tableKeyName},
    ${propertyNameListStr}
) {
    //TODO: auth
    // change
    await ${tableIdentifier}.update(
        {
            ${this.tableKeyName}: ${this.tableKeyName},
        },
        {
            ${propertyNameMapStr}
        }
    );
}

// remove
module.exports.remove${this.tableName} = remove${this.tableName};
async function remove${this.tableName} (token, ${this.tableKeyName}) {
    await ${tableIdentifier}.deleteFrom(
        {
            ${this.tableKeyName}: ${this.tableKeyName},
        }
    );
}

// stub.js
{action: "get${this.tableName}",        func: AuditingQa.get${this.tableName}},
{action: "create${this.tableName}",     func: AuditingQa.create${this.tableName}},
{action: "change${this.tableName}",     func: AuditingQa.change${this.tableName}},
{action: "remove${this.tableName}",     func: AuditingQa.remove${this.tableName}},

        `;
        fs.appendFile('crud.gen', content, err => {
            if (err) {
                console.error(err);
            } else {
                // file written successfully
            }
        });
        console.log("generated code stored in crud.gen");
    }
}
module.exports.DatabaseTable = DatabaseTable;