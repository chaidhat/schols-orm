
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

it('can select all from table', async function () {
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


    // test select
    const res = await options.debugTestTable.select();

    // test
    assert.equal(
        res.length, 
        common.MAX_LEN
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
                    orm.readBool(res[i].c), 
                    mem[j].c
                );
            }
        }
        assert.ok(found);
    }
});
it('can select where from table with tablePrivateKey', async function () {
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
        const res = await options.debugTestTable.select({debugTestTableId: randomIndex});
        assert.equal(
            res.length,
            1
        );
        assert.equal(
            res[0].a,
            mem[randomIndex - 1].a
        );
        const res2 = await options.debugTestTable.select({a: mem[randomIndex - 1].a});
        assert.equal(
            res2[0].debugTestTableId,
            mem[randomIndex - 1].debugTestTableId
        );
    }
});
it('can select and return multiple answers', async function () {
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

    const res = await options.debugTestTable.select({c: true});
    let countOfTrues = 0;
    for (let j = 0; j < mem.length; j++) {
        if (mem[j].c) {
            countOfTrues++;
        }
    }
});
it("can select by passing multiple properties into where", async function () {
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

    for (let i = 0; i < 10; i++) {
        const randomIndex = randomInt(1, common.MAX_LEN);
        const res = await options.debugTestTable.select({a: mem[randomIndex - 1].a, b: mem[randomIndex - 1].b});
        assert.equal(
            res[0].debugTestTableId,
            mem[randomIndex - 1].debugTestTableId
        );
    }
});
it("can select by passing array into a where property", async function () {
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
        const randomIndex1 = randomInt(1, common.MAX_LEN);
        const randomIndex2 = randomInt(1, common.MAX_LEN);
        const res = await options.debugTestTable.select({a: [mem[randomIndex1 - 1].a, mem[randomIndex2 - 1].a]});
        if (
            ((res[0].debugTestTableId === randomIndex1) && (res[1].debugTestTableId === randomIndex2)) ||
            ((res[0].debugTestTableId === randomIndex2) && (res[1].debugTestTableId === randomIndex1))
        ) {
            // OK
        } else {
            throw 'fail';
        }
    }
});

it('should fail when select() with incorrect data types', async function () {
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
            await options.debugTestTable.select(
                {
                    b: 1,    // b is a varchar, not an int
                },
            );
        }
    );
    await assert.rejects(
        async () => {
            await options.debugTestTable.select(
                {
                    b: ["A", 1],    // b is a varchar, not an int
                },
            );
        }
    );
});

it('should fail when select() with nonexistent properties', async function () {
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
            await options.debugTestTable.select(
                {
                    bloop: 1, // not a property name
                },
            );
        }
    );
});

it('should select from one-to-many relation', async function () {
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

it('should select from N one-to-many relation', async function () {
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

    options.debugTestTable1 = new orm.DatabaseTable(`DebugTestTable1`,
        "debugTestTable1Id",
        [
            {
                name: "debugTestTableId",
                type: "int"
            },
            {   // NOTE: throw in a zinger: this shouldn't be accounted for at all
                name: "debugTestTable0Id",
                type: "int"
            },
            {
                name: "ea",
                type: "int"
            },
        ]);
    await options.debugTestTable1.init();

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
            {
                name: "e",
                type: `DebugTestTable1[]`, // one-to-many relation
                // this requires options.debugTestTable0 to have a property with the name `DebugTestTableid`
            },
        ]);
    await options.debugTestTable.init();

    const mem = [];
    let debugTestTable0IdKey = 1;
    let debugTestTable1IdKey = 1;
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
        const e = [];
        for (let j = 0; j < randomInt(0, 3); j++) {
            e.push({
                debugTestTable1Id: debugTestTable1IdKey,
                debugTestTable0Id: randomInt(0, common.MAX_LEN), // throw in a zinger: this shouldn't be accounted for at all.
                debugTestTableId: i + 1,
                ea: randomInt(),
            })
            debugTestTable1IdKey++;
        }
        mem[i] = {
            debugTestTableId: i + 1,
            a: randomInt(),
            b: randomStr(),
            d: d,
            e: e,
        };
        await orm.adminQuery(`INSERT INTO DebugTestTable (debugTestTableId, a,b) VALUES (${mem[i].debugTestTableId}, ${mem[i].a}, "${mem[i].b}")`);
        for (let j = 0; j < d.length; j++) {
            await orm.adminQuery(`INSERT INTO DebugTestTable0 (debugTestTable0Id, debugTestTableId, da, db) VALUES (${d[j].debugTestTable0Id}, ${d[j].debugTestTableId}, ${d[j].da}, "${d[j].db}")`);
        }
        for (let j = 0; j < e.length; j++) {
            await orm.adminQuery(`INSERT INTO DebugTestTable1 (debugTestTable1Id, debugTestTable0Id, debugTestTableId, ea) VALUES (${e[j].debugTestTable1Id}, ${e[j].debugTestTable0Id}, ${e[j].debugTestTableId}, ${e[j].ea})`);
        }
    }

    // test
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
        assert.equal(
            memVal.e.length,
            foundRes.e.length,
        );
        memVal.e.forEach((ee) => {
            const foundResE = foundRes.e.find((resElement) =>
                resElement.debugTestTable1Id == ee.debugTestTable1Id
            );
            if (foundRes === undefined) {
                throw `fail: did not find relation ${JSON.stringify(ee)} ${memVal.debugTestTableId} (idx: ${i}) in DebugTestTable0`
            }
            
            assert.equal(ee.ea, foundResE.ea);
            assert.equal(ee.debugTestTable0Id, foundResE.debugTestTable0Id);
            assert.equal(memVal.debugTestTableId, foundResE.debugTestTableId);
        });
    });
});