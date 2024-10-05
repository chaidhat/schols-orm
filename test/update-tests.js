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

it('can update table', async function () {
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
            debugTestTableId: i + 1,
            a: randomInt(),
            b: randomStr(),
            c: randomInt() > 0,
        };
        await orm.adminQuery(`INSERT INTO DebugTestTable (debugTestTableId, a,b,c) VALUES (${mem[i].debugTestTableId}, ${mem[i].a}, "${mem[i].b}", ${mem[i].c})`);
    }

    // test
    for (let i = 0; i < 10; i++) {
        const randomIndex = randomInt(1, common.MAX_LEN);
        mem[randomIndex] = {
            debugTestTableId: randomIndex + 1,
            a: randomInt(),
            b: randomStr(),
            c: randomInt() > 0,
        };
        await options.debugTestTable.update(
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
    for (let i = 0; i < 10; i++) {
        const randomIndex = randomInt(1, common.MAX_LEN);
        mem[randomIndex].a = randomInt();
        await options.debugTestTable.update(
            {
                b: mem[randomIndex].b,
                c: mem[randomIndex].c
            },
            {
                a: mem[randomIndex].a,
            }
        );
    }

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
it('should fail when update() with incorrect arguments', async function () {
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

    await orm.adminQuery(`INSERT INTO DebugTestTable (debugTestTableId, a,b,c) VALUES (1, 2, "apple", 0)`);
    // test
    await assert.rejects(
        async () => {
            await options.debugTestTable.update(
                {
                    debugTestTableId: 1,
                },
                // MISSING ENTRY ARG
            )
        }
    );
});
it('should fail when update() with incorrect data types', async function () {
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

    await orm.adminQuery(`INSERT INTO DebugTestTable (debugTestTableId, a,b,c) VALUES (1, 2, "apple", 0)`);
    // test
    await assert.rejects(
        async () => {
            await options.debugTestTable.update(
                {
                    debugTestTableId: 1,
                },
                {
                    a: "should fail" // a is a int, not a varchar
                },
            );
        }
    );
    await assert.rejects(
        async () => {
            await options.debugTestTable.update(
                {
                    a: "should fail", // a is an int, not a varchar
                },
                {
                    b: 1
                },
            );
        }
    );
});
it('should fail when update() with nonexistent properties', async function () {
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

    await orm.adminQuery(`INSERT INTO DebugTestTable (debugTestTableId, a,b,c) VALUES (1, 2, "apple", 0)`);
    // test
    await assert.rejects(
        async () => {
            await options.debugTestTable.update(
                {
                    debugTestTableId: 1,
                },
                {
                    bloop: "should fail" // not a property name
                },
            );
        }
    );
    await assert.rejects(
        async () => {
            await options.debugTestTable.update(
                {
                    bloop: 1, // not a property name
                },
                {
                    b: 1
                },
            );
        }
    );
    await assert.rejects(
        async () => {
            await options.debugTestTable.update(
                {
                },
                {
                    b: 1
                },
            );
        }
    );
});
it('can update table with one-to-many relation', async function () {
    // setup 
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
                name: "d",
                type: `DebugTestTable0[]`, // one-to-many relation
                // this requires options.debugTestTable0 to have a property with the name `DebugTestTableid`
            },
        ]);
    await options.debugTestTable.init();

    const mem = [];
    let debugTestTable0IdKey = 1;
    for (let i = 0; i < common.MAX_LEN; i++) {
        const d = [];
        for (let j = 0; j < randomInt(0, 3); j++) {
            d.push({
                debugTestTable0Id: debugTestTable0IdKey,
                debugTestTableId: i + 1,
                da: randomInt(),
                db: randomStr(),
            })
            debugTestTable0IdKey++;
        }
        mem[i] = {
            debugTestTableId: i + 1,
            a: randomInt(),
            b: randomStr(),
            d: d,
        };
        await orm.adminQuery(`INSERT INTO DebugTestTable (debugTestTableId, a,b) VALUES (${mem[i].debugTestTableId}, ${mem[i].a}, "${mem[i].b}")`);
        for (let j = 0; j < d.length; j++) {
            await orm.adminQuery(`INSERT INTO DebugTestTable0 (debugTestTable0Id, debugTestTableId, da, db) VALUES (${d[j].debugTestTable0Id}, ${d[j].debugTestTableId}, ${d[j].da}, "${d[j].db}")`);
        }
    }

    // test
    for (let i = 0; i < 10; i++) {
        const randomIndex = randomInt(1, common.MAX_LEN);
        const d = [];
        for (let j = 0; j < randomInt(0, 3); j++) {
            d.push({
                debugTestTable0Id: debugTestTable0IdKey,
                debugTestTableId: randomIndex,
                da: randomInt(),
                db: randomStr(),
            })
            debugTestTable0IdKey++;
        }
        mem[randomIndex] = {
            debugTestTableId: randomIndex + 1,
            a: randomInt(),
            b: randomStr(),
            d: d,
        };
        await options.debugTestTable.update(
            {
                debugTestTableId: randomIndex + 1,
            },
            {
                a: mem[randomIndex].a,
                b: mem[randomIndex].b,
                d: mem[randomIndex].d.map((x) => {return {da: x.da, db: x.db}}),
            }
        );
    }

    const res = await options.debugTestTable.select();
    assert.equal(
        res.length,
        mem.length,
    );

    let i = 0;
    mem.forEach((memVal) => {
        const foundRes = res.find((resElement) =>
            resElement.debugTestTableId == memVal.debugTestTableId
        );
        if (foundRes === undefined) {
            throw `fail: did not find relation ${JSON.stringify(memVal)} ${memVal.debugTestTableId} (idx: ${i}) in DebugTestTable0`
        }

        assert.equal(memVal.a, foundRes.a);
        assert.equal(memVal.b, foundRes.b);
        assert.equal(
            memVal.d.length,
            foundRes.d.length,
        );
        memVal.d.forEach((dd) => {
            const foundResD = foundRes.d.find((resElement) =>
                resElement.debugTestTable0Id == dd.debugTestTable0Id
            );
            if (foundRes === undefined) {
                throw `fail: did not find relation ${JSON.stringify(dd)} ${memVal.debugTestTableId} (idx: ${i}) in DebugTestTable0`
            }
            
            assert.equal(dd.da, foundResD.da);
            assert.equal(dd.db, foundResD.db);
            assert.equal(memVal.debugTestTableId, foundResD.debugTestTableId);
        });
    });
});