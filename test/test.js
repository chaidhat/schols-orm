var assert = require('assert');

const orm = require('../lib/orm');

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
    return Math.floor((Math.random() * (maxInt - minInt)) + minInt);
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

const DEBUG_TEST_TABLE = "DebugTestTable";

// assume connection is OK already
// cleanup BEFORE running ANY test
// this ensure consistent states
//
// 1. all DEBUG_TEST_TABLES will be dropped
async function cleanupTests() {
    const doesTestTableExist = await sqlDoesTableExist(DEBUG_TEST_TABLE);
    if (doesTestTableExist) {
        await orm.adminQuery(`DROP TABLE ${DEBUG_TEST_TABLE}`);
    }
    assert.equal(await sqlDoesTableExist(DEBUG_TEST_TABLE), false);
}


module.exports.runTests = runTests;
async function runTests() {
    describe('orm', function () {
        before(async function () {
            await cleanupTests();
        });
        after(async function () {
            await cleanupTests();
        });
        describe('clean state tests', function () {
            let debugTestTable;
            beforeEach(async function () {
                await cleanupTests();
            });
            afterEach(async function () {
                await debugTestTable.drop();
                await cleanupTests();
            });
            it('can create a table', async function () {
                assert.equal(
                    await sqlDoesTableExist(DEBUG_TEST_TABLE),
                    false
                );
                debugTestTable = new orm.DatabaseTable(`${DEBUG_TEST_TABLE}`,
                    "debugTestTableId",
                    [
                        {
                        name: "a",
                        type: "int"
                        },
                        {
                        name: "b",
                        type: "varchar(256)"
                        },
                        {
                        name: "c",
                        type: "bit"
                        },
                ]);
                await debugTestTable.init();
                assert.ok(await sqlDoesTableExist(DEBUG_TEST_TABLE));
                await debugTestTable.drop();
            });
            it('can create table with correct names', async function () {
                debugTestTable = new orm.DatabaseTable(`${DEBUG_TEST_TABLE}`,
                    "debugTestTableId",
                    [
                        {
                        name: "a",
                        type: "int"
                        },
                        {
                        name: "b",
                        type: "varchar(256)"
                        },
                        {
                        name: "c",
                        type: "bit"
                        },
                ]);
                await debugTestTable.init();
                assert.ok(await sqlDoesColumnNameExistInTable(DEBUG_TEST_TABLE, "a"));
                assert.ok(await sqlDoesColumnNameExistInTable(DEBUG_TEST_TABLE, "b"));
                assert.ok(await sqlDoesColumnNameExistInTable(DEBUG_TEST_TABLE, "c"));

                // testing the tests
                assert.equal(await sqlDoesColumnNameExistInTable(DEBUG_TEST_TABLE, "d"), false);
                await debugTestTable.drop();
            });



            it('can create table with correct datatypes', async function () {
                debugTestTable = new orm.DatabaseTable(`${DEBUG_TEST_TABLE}`,
                    "debugTestTableId",
                    [
                        {
                        name: "a",
                        type: "int"
                        },
                        {
                        name: "b",
                        type: "varchar(256)"
                        },
                        {
                        name: "c",
                        type: "bit"
                        },
                ]);
                await debugTestTable.init();
                assert.ok(await sqlIsColumnRightDataType(DEBUG_TEST_TABLE, "a", "int", null));
                assert.ok(await sqlIsColumnRightDataType(DEBUG_TEST_TABLE, "b", "varchar", 256));
                assert.ok(await sqlIsColumnRightDataType(DEBUG_TEST_TABLE, "c", "bit", null));

                // testing the tests
                assert.equal(await sqlIsColumnRightDataType(DEBUG_TEST_TABLE, "a", "bit", null), false);
                assert.equal(await sqlIsColumnRightDataType(DEBUG_TEST_TABLE, "d", "int", null), false);
                await debugTestTable.drop();
            });
        });
        describe('operations tests', function () {
            let debugTestTable;
            beforeEach(async function () {
                await cleanupTests();
                debugTestTable = new orm.DatabaseTable(`${DEBUG_TEST_TABLE}`,
                    "debugTestTableId",
                    [
                        {
                        name: "a",
                        type: "int"
                        },
                        {
                        name: "b",
                        type: "varchar(256)"
                        },
                        {
                        name: "c",
                        type: "bit"
                        },
                ]);
                await debugTestTable.init();
            });
            afterEach(async function () {
                await debugTestTable.drop();
                await cleanupTests();
            });
            


            it('can insert into table (depth 1)', async function () {
                // setup 
                const mem = [];
                const MAX_LEN = 100;
                for (let i = 0; i < MAX_LEN; i++) {
                    mem[i] = {
                        a: randomInt(),
                        b: randomStr(),
                        c: randomInt() > 0,
                    };
                    await debugTestTable.insertInto(
                    {
                        a: mem[i].a,
                        b: mem[i].b,
                        c: mem[i].c
                    });
                }

                // test
                const res = await orm.adminQuery(`SELECT * FROM ${DEBUG_TEST_TABLE} ORDER BY debugTestTableId ASC`);
                assert.equal(
                    res.length, 
                    MAX_LEN
                );

                for (let i = 0; i < res.length; i++) {
                    assert.equal(
                        res[i].debugTestTableId, 
                        i + 1
                    );
                    assert.equal(
                        res[i].a, 
                        mem[i].a
                    );
                    assert.equal(
                        res[i].b, 
                        mem[i].b
                    );
                    assert.equal(
                        orm.readBool(res[i].c), 
                        mem[i].c
                    );
                }
            });
            it('can select from table (depth 1)', async function () {
                // setup 
                const mem = [];
                const MAX_LEN = 100;
                for (let i = 0; i < MAX_LEN; i++) {
                    mem[i] = {
                        debugTestTableId: i + 1,
                        a: randomInt(),
                        b: randomStr(),
                        c: randomInt() > 0,
                    };
                    await orm.adminQuery(`INSERT INTO ${DEBUG_TEST_TABLE} (debugTestTableId, a,b,c) VALUES (${mem[i].debugTestTableId}, ${mem[i].a}, "${mem[i].b}", ${mem[i].c})`);
                }


                // test select
                const res = await debugTestTable.select();

                // test
                assert.equal(
                    res.length, 
                    MAX_LEN
                );

                for (let i = 0; i < res.length; i++) {
                    let found = false;
                    for (let j = 0; j < mem.length; j++) {
                        if (mem[j].debugTestTableId === res[i].debugTestTableId) {
                            found = true;
                            assert.equal(
                                res[i].a, 
                                mem[j].a
                            );
                            assert.equal(
                                res[i].b, 
                                mem[j].b
                            );
                            assert.equal(
                                res[i].c, 
                                mem[j].c
                            );
                        }
                    }
                    assert.ok(found);
                }
            });
            it('can update table (depth 1)', async function () {
                // setup 
                const mem = [];
                const MAX_LEN = 100;
                for (let i = 0; i < MAX_LEN; i++) {
                    mem[i] = {
                        debugTestTableId: i + 1,
                        a: randomInt(),
                        b: randomStr(),
                        c: randomInt() > 0,
                    };
                    await orm.adminQuery(`INSERT INTO ${DEBUG_TEST_TABLE} (debugTestTableId, a,b,c) VALUES (${mem[i].debugTestTableId}, ${mem[i].a}, "${mem[i].b}", ${mem[i].c})`);
                }

                // test update
                for (let i = 0; i < 10; i++) {
                    const randomIndex = randomInt(1, MAX_LEN);
                    mem[randomIndex] = {
                        debugTestTableId: randomIndex + 1,
                        a: randomInt(),
                        b: randomStr(),
                        c: randomInt() > 0,
                    };
                    await debugTestTable.update(
                        {
                            debugTestTableId: randomIndex + 1,
                        },
                        {
                            a: mem[randomIndex].a,
                            b: mem[randomIndex].b,
                            c: mem[randomIndex].c,
                        }
                    );
                }

                // test
                const res = await orm.adminQuery(`SELECT * FROM ${DEBUG_TEST_TABLE} ORDER BY debugTestTableId ASC`);
                assert.equal(
                    res.length, 
                    MAX_LEN
                );

                for (let i = 0; i < res.length; i++) {
                    assert.equal(
                        res[i].debugTestTableId, 
                        i + 1
                    );
                    assert.equal(
                        res[i].a, 
                        mem[i].a
                    );
                    assert.equal(
                        res[i].b, 
                        mem[i].b
                    );
                    assert.equal(
                        orm.readBool(res[i].c), 
                        mem[i].c
                    );
                }
            });
            it('should fail on wrong update syntax', async function () {
                // setup 
                const mem = [];
                const MAX_LEN = 100;
            });
        });
    });
}