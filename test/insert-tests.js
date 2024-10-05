const common = require("./common");
const options = common.options;
const assert = common.assert;
const orm = common.orm;

// import helper functions
const randomStr = common.randomStr;
const randomInt = common.randomInt;
const sqlDoesTableExist = common.sqlDoesTableExist;
const sqlDoesColumnNameExistInTable = common.sqlDoesColumnNameExistInTable;
const sqlIsColumnRightDataType = common.sqlIsColumnRightDataType;


it('can insert into table', async function () {
    // setup 
    options.debugTestTable = new orm.DatabaseTable(`DebugTestTable`,
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
    await options.debugTestTable.init();

    const mem = [];
    for (let i = 0; i < common.MAX_LEN; i++) {
        mem[i] = {
            a: randomInt(),
            b: randomStr(),
            c: randomInt() > 0,
        };
        await options.debugTestTable.insertInto(
            {
                a: mem[i].a,
                b: mem[i].b,
                c: mem[i].c
            });
    }

    // test
    const res = await orm.adminQuery(`SELECT * FROM DebugTestTable ORDER BY debugTestTableId ASC`);
    assert.equal(
        res.length,
        common.MAX_LEN
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

it('should fail when insertInto() with incorrect data types', async function () {
    // test
    options.debugTestTable = new orm.DatabaseTable(`DebugTestTable`,
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
    await options.debugTestTable.init();

    await assert.rejects(
        async () => {
            await options.debugTestTable.insertInto(
                {
                    a: 2,
                    b: 4, // should fail as b is a varchar, not an int
                    c: true,
                },
            );
        }
    );
});

it('should fail when insertInto() with nonexistent properties', async function () {
    // setup
    options.debugTestTable = new orm.DatabaseTable(`DebugTestTable`,
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
    await options.debugTestTable.init();

    // test
    await assert.rejects(
        async () => {
            await options.debugTestTable.insertInto(
                {
                    bloop: 2, // not a property name
                },
            );
        }
    );
});

it('should insert into one-to-many relation', async function () {
    options.debugTestTable0 = new orm.DatabaseTable(`DebugTestTable0`,
        "debugTestTable0Id",
        [
            {
                name: "debugTestTableId",
                type: "int"
            },
            {
                name: "da",
                type: "int"
            },
            {
                name: "db",
                type: "varchar(256)"
            },
        ]);
    await options.debugTestTable0.init();

    options.debugTestTable = new orm.DatabaseTable(`DebugTestTable`,
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
            {
                name: "d",
                type: `DebugTestTable0[]`, // one-to-many relation
                // this requires options.debugTestTable0 to have a property with the name `DebugTestTableid`
            },
        ]);
    await options.debugTestTable.init();

    const mem = [];
    let debugTestTable0IdKey = 1;
    for (let i = 0; i < common.MAX_LEN / 10; i++) {
        const d = [];
        for (let j = 0; j < randomInt(0, 20); j++) {
            d.push({
                debugTestTable0Id: debugTestTable0IdKey,
                da: randomInt(),
                db: randomStr(),
            })
            debugTestTable0IdKey++;
        }
        mem[i] = {
            debugTestTableId: i + 1,
            a: randomInt(),
            b: randomStr(),
            c: randomInt() > 0,
            d: d,
        };
        await options.debugTestTable.insertInto(
            {
                a: mem[i].a,
                b: mem[i].b,
                c: mem[i].c,
                d: mem[i].d.map((x) => {return {da: x.da, db: x.db}}),
                // d is an array of [{da: 123, db: "abc"}, {da: 234, db: "def"}, ... ]
            });
    }

    // test
    const res = await orm.adminQuery(`SELECT * FROM DebugTestTable ORDER BY debugTestTableId ASC`);
    assert.equal(
        res.length,
        common.MAX_LEN / 10
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

    const res2 = await orm.adminQuery(`SELECT * FROM DebugTestTable0 ORDER BY debugTestTable0Id ASC`);
    assert.equal(
        res2.length,
        debugTestTable0IdKey - 1
    );

    let i = 0;
    mem.forEach((memVal) => {
        memVal.d.forEach((dd) => {
            const foundRes = res2.find((resElement) =>
                resElement.da == dd.da &&
                resElement.db == dd.db &&
                resElement.debugTestTable0Id == dd.debugTestTable0Id &&
                resElement.debugTestTableId == memVal.debugTestTableId
            );
            if (foundRes === undefined) {
                throw `fail: did not find relation ${JSON.stringify(dd)} ${memVal.debugTestTableId} (idx: ${i}) in DebugTestTable0`
            }
        });
        i++;
    });
});

it('should fail when insert into one-to-many relation with non array', async function () {
    options.debugTestTable0 = new orm.DatabaseTable(`DebugTestTable0`,
        "debugTestTable0Id",
        [
            {
                name: "debugTestTableId",
                type: "int"
            },
            {
                name: "da",
                type: "int"
            },
            {
                name: "db",
                type: "varchar(256)"
            },
        ]);
    await options.debugTestTable0.init();

    options.debugTestTable = new orm.DatabaseTable(`DebugTestTable`,
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
            {
                name: "d",
                type: `DebugTestTable0[]`, // one-to-many relation
                // this requires options.debugTestTable0 to have a property with the name `DebugTestTableid`
            },
    ]);
    await options.debugTestTable.init();

    // test
    await assert.rejects(
        async () => {
        await options.debugTestTable.insertInto(
            {
                a: randomInt(),
                b: randomStr(),
                c: randomInt() > 0,
                d: {  // THIS SHOULD BE AN ARRAY
                    da: randomInt(),
                    db: randomStr(),
                }
            });
    });
});