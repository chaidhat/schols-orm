const fs = require('node:fs');

const ormChecker = require("./checker");
const ormSql = require("./sql");
const ormHelper = require("./helper");
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

    constructor(tableName, tablePrivateKeyName, properties) {
        this.tableName = tableName;
        this.tableKeyName = tablePrivateKeyName;
        this.properties = properties;

        // validate the table
        ormChecker.validateTable(this);
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
        this.properties.forEach((item, index, arr) => {
            queryStr += `${item.name} ${item.type}, `;
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
        ormChecker.removeTableFromValidation(this);
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
        let selectColumns = [];
        selectColumns.push(`${this.tableName}.${this.tableKeyName}`);
        for (let i = 0; i < this.properties.length; i++) {
            selectColumns.push(`${this.tableName}.${this.properties[i].name}`);
        }
        if (hasIncludes) {
            // if there are includes, type it the LOOOONG wayy
            try {
                const includeTable = options.include;
                selectColumns.push(`${includeTable.tableName}.${includeTable.tableKeyName} AS ${includeTable.tableName}_${includeTable.tableKeyName}`);
                for (let j = 0; j < includeTable.properties.length; j++) {
                    selectColumns.push(`${includeTable.tableName}.${includeTable.properties[j].name} AS ${includeTable.tableName}_${includeTable.properties[j].name}`);
                }
            } catch (e) {
                throw "orm fatal: include clause in select failed: incorrectly formatted."
            }
        }

        // FROM
        queryStr += `    ${selectColumns.join(", \n    ")}\n`;
        queryStr += `FROM ${this.tableName} \n`;

        // INNER JOINS
        if (hasIncludes) {
            try {
                const includeTable = options.include;
                // case 1: if includeTable has this.tableKeyName in it, use it
                // NOTE: this is where removing property x from includeTable.properties where x.name === this.tableKeyName
                let includeTableHasThisTableKeyName = false;
                for (let j = 0; j < includeTable.properties.length; j++) {
                    const property = includeTable.properties[j];
                    if (property.name === this.tableKeyName) {
                        includeTableHasThisTableKeyName = true;
                        break;
                    }
                }
                // case 2: if this table has includeTable's tableKeyName in it, use it.
                let thisTableHasIncludeTablesTableKeyName = false;
                for (let j = 0; j < this.properties.length; j++) {
                    const property = this.properties[j];
                    if (property.name === includeTable.tableKeyName) {
                        thisTableHasIncludeTablesTableKeyName = true;
                        break;
                    }
                }
                if (includeTableHasThisTableKeyName && !thisTableHasIncludeTablesTableKeyName) {
                    // case 1
                    queryStr += ` LEFT OUTER JOIN ${includeTable.tableName} ON ${this.tableName}.${this.tableKeyName} = ${includeTable.tableName}.${this.tableKeyName}\n`;

                } else if (!includeTableHasThisTableKeyName && thisTableHasIncludeTablesTableKeyName && !includeTableHasThisTableKeyName) {
                    // case 2
                    queryStr += ` LEFT OUTER JOIN ${includeTable.tableName} ON ${this.tableName}.${includeTable.tableKeyName} = ${includeTable.tableName}.${includeTable.tableKeyName}\n`;

                } else if (!thisTableHasIncludeTablesTableKeyName && !includeTableHasThisTableKeyName) {
                    throw `include clause in select failed: this table and ${includeTable.tableName} are not explicitly related.`

                } else {
                    throw `include clause in select failed: this table and ${includeTable.tableName} are doubly related.`

                }
            } catch (e) {
                throw "orm fatal: include clause in select failed: incorrectly formatted."
            }
        }

        // WHERE
        if (hasWhere) {
            let queryStrWheres = "";
            for (let name in where) {
                let value = where[name];

                if (typeof value !== "object") {
                    // normally do it
                    queryStrWheres += `${this.tableName}.${name} = ${ormHelper.sanitizeSqlValue(value)} AND `;
                } else {
                    // if the value is just an empty array
                    if (value.length === 0) {
                        return [];
                    }

                    // for e.g., SELECT * WHERE names IN (1, 2, 3)
                    let queryStrObjects = "( "
                    for (let i = 0; i < value.length; i++) {
                        let singleValue = value[i];
                        queryStrObjects += ormHelper.sanitizeSqlValue(singleValue) + ", ";
                    }
                    // remove the ,  at the end
                    queryStrObjects = queryStrObjects.substring(0, queryStrObjects.length - 2);
                    queryStrObjects += ")";

                    
                    queryStrWheres += `${this.tableName}.${name} IN ${queryStrObjects} AND `;
                    continue;
                }
            }
            // remove the AND at the end
            queryStrWheres = queryStrWheres.substring(0, queryStrWheres.length - 5);

            queryStr += ` WHERE ${queryStrWheres}`
        }

        // optional additional suffix
        if (hasSuffix) {
            // todo: make sure suffix is clean!
            queryStr += ` ${options.suffix}`;
        }

        // execute
        queryStr += ";";
        let output = await this.query(queryStr);

        // format
        // format includes
        if (hasIncludes) {
            const includeTable = options.include;
            // create an includeMap
            // includeMap maps rowKey -> [ list of include tables which belong to this table's rowkey ]
            let includeMap = {};
            // create an outputMap
            // outputMap maps rowKey -> { properties of this table's rowKey }
            let outputMap = {};
            for (let i = 0; i < output.length; i++) {
                const row = JSON.parse(JSON.stringify(output[i]));
                const rowKey = row[this.tableKeyName];

                if (includeMap[rowKey] === undefined) {
                    includeMap[rowKey] = [];
                }
                if (outputMap[rowKey] === undefined) {
                    outputMap[rowKey] = {};
                }

                const includeMapRow = {};
                Object.keys(row).forEach((property) => {
                    const value = row[property];
                    const propertySplit = property.split("_");
                    if (propertySplit.length > 1) {
                        // this means that the property belongs to the include table
                        if (value !== null) {
                            // this belongs to a different able
                            const tableProperty = propertySplit[1];
                            includeMapRow[tableProperty] = value;
                        }
                    } else {
                        // this means that the property belongs to this table
                        outputMap[rowKey][property] = value;
                    }
                });
                if (Object.keys(includeMapRow).length) {
                    includeMap[rowKey].push(includeMapRow);
                }
            }
            // combine the includeMap and outputMap into a new outpt
            Object.keys(includeMap).forEach((key) => {
                outputMap[key][includeTable.tableName] = includeMap[key];
            });
            let newOutput = [];
            Object.keys(outputMap).forEach((key) => {
                newOutput.push(outputMap[key]);
            });
            output = newOutput;
        }
        // format table values
        for (let i = 0; i < output.length; i++) {
            for (const [key, value] of Object.entries(output[i])) {
                // find property in table
                let tableProperty = null;
                for (let j = 0; j < this.properties.length; j++) {
                    if (this.properties[j].name === key) {
                        tableProperty = this.properties[j];
                    }
                }
                // format that value
                if (tableProperty !== null) {
                    switch (tableProperty.type) {
                        case "bit":
                            output[i][key] = ormHelper.readBool(value);
                            break;
                    }
                }
            }
        }

        return output;
    }

    async selectMax(columnName, where) {
        let queryStr = `SELECT MAX(${columnName}) AS ${columnName} FROM ${this.tableName}`;
        if (where !== undefined) {
            let queryStrWheres = "";
            for (let name in where) {
                let value = where[name];
                queryStrWheres += `${name} = ${ormHelper.sanitizeSqlValue(value)} AND `;
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
            throw `orm fatal: 'entry' clause not provided in insert()`;
        }
        let queryStrCol = `${this.tableKeyName}, `;
        let nextKey = await this.getNextKey();
        let queryStrVal = `${nextKey}, `;
        for (let name in entry) {
            let value = entry[name];
            queryStrCol += `${name}, `;
            queryStrVal += `${ormHelper.sanitizeSqlValue(value)}, `
        }
        // remove the , at the end
        queryStrCol = queryStrCol.substring(0, queryStrCol.length - 2);
        queryStrVal = queryStrVal.substring(0, queryStrVal.length - 2);

        let queryStr = `INSERT INTO ${this.tableName} (${queryStrCol}) VALUES (${queryStrVal});`;
        await this.query(queryStr);
        return nextKey;
    }

    async update(where, entry) {
        if (where === null) {
            throw `orm fatal: 'where' clause not provided in update()`;
        }
        if (entry === null) {
            throw `orm fatal: 'entry' clause not provided in update()`;
        }
        let queryStrWheres = "";
        for (let name in where) {
            let value = where[name];
            queryStrWheres += `${name} = ${ormHelper.sanitizeSqlValue(value)} AND `;
        }
        // remove the AND at the end
        queryStrWheres = queryStrWheres.substring(0, queryStrWheres.length - 5);

        let queryStrEntries = "";
        for (let name in entry) {
            let value = entry[name];
            queryStrEntries += `${name} = ${ormHelper.sanitizeSqlValue(value)}, `;
        }
        // remove the , at the end
        queryStrEntries = queryStrEntries.substring(0, queryStrEntries.length - 2);

        let queryStr = `UPDATE ${this.tableName} SET ${queryStrEntries} WHERE ${queryStrWheres};`;
        await this.query(queryStr);
    }

    async deleteFrom(where) {
        let queryStrWheres = "";
        for (let name in where) {
            let value = where[name];
            queryStrWheres += `${name} = ${ormHelper.sanitizeSqlValue(value)} AND `;
        }
        // remove the AND at the end
        queryStrWheres = queryStrWheres.substring(0, queryStrWheres.length - 5);
        let queryStr = `DELETE FROM ${this.tableName} WHERE ${queryStrWheres}`;
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