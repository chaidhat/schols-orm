
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

it('can create a table', async function () {
    assert.equal(
        await sqlDoesTableExist("DebugTestTable"),
        false
    );
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
    assert.ok(await sqlDoesTableExist("DebugTestTable"));
    await options.debugTestTable.drop();
});
it('can create table with correct names', async function () {
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
    assert.ok(await sqlDoesColumnNameExistInTable("DebugTestTable", "debugTestTableId"));
    assert.ok(await sqlDoesColumnNameExistInTable("DebugTestTable", "a"));
    assert.ok(await sqlDoesColumnNameExistInTable("DebugTestTable", "b"));
    assert.ok(await sqlDoesColumnNameExistInTable("DebugTestTable", "c"));

    // testing the tests
    assert.equal(await sqlDoesColumnNameExistInTable("DebugTestTable", "d"), false);
    await options.debugTestTable.drop();
});



it('can create table with correct datatypes', async function () {
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
    assert.ok(await sqlIsColumnRightDataType("DebugTestTable", "debugTestTableId", "int", null));
    assert.ok(await sqlIsColumnRightDataType("DebugTestTable", "a", "int", null));
    assert.ok(await sqlIsColumnRightDataType("DebugTestTable", "b", "varchar", 256));
    assert.ok(await sqlIsColumnRightDataType("DebugTestTable", "c", "bit", null));

    // testing the tests
    assert.equal(await sqlIsColumnRightDataType("DebugTestTable", "a", "bit", null), false);
    assert.equal(await sqlIsColumnRightDataType("DebugTestTable", "d", "int", null), false);
    await options.debugTestTable.drop();
});

it('should fail with two duplicate properties', async function () {
    await assert.rejects(
        async () => {
            options.debugTestTable = new orm.DatabaseTable(`DebugTestTable`,
                "debugTestTableId",
                [
                    {
                        name: "a",
                        type: "int"
                    },
                    {
                        name: "a", // DUPLICATE NAME
                        type: "varchar(256)"
                    },
                    ,
                ]);
            await options.debugTestTable.init();
        });
});

it('should create one-to-many relation in a table', async function () {
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
    assert.ok(await sqlDoesTableExist("DebugTestTable"));
    assert.ok(await sqlDoesTableExist(`DebugTestTable0`));

    assert.ok(await sqlDoesColumnNameExistInTable("DebugTestTable", "debugTestTableId"));
    assert.ok(await sqlDoesColumnNameExistInTable("DebugTestTable", "a"));
    assert.ok(await sqlDoesColumnNameExistInTable("DebugTestTable", "b"));
    assert.ok(await sqlDoesColumnNameExistInTable("DebugTestTable", "c"));
    assert.ok(await sqlDoesColumnNameExistInTable(`DebugTestTable0`, "debugTestTable0Id"));
    assert.ok(await sqlDoesColumnNameExistInTable(`DebugTestTable0`, "debugTestTableId"));
    assert.ok(await sqlDoesColumnNameExistInTable(`DebugTestTable0`, "da"));
    assert.ok(await sqlDoesColumnNameExistInTable(`DebugTestTable0`, "db"));
});

it('should fail one-to-many relation if tableKey is not in dependentTable', async function () {
    options.debugTestTable0 = new orm.DatabaseTable(`DebugTestTable0`,
        "debugTestTable0Id",
        [
            /*
            // NOT in dependent table, so should fail.
            {
            name: "debugTestTableId",
            type: "int"
            },
            */
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

    await assert.rejects(
        async () => {
            await orm.validateAllTables();
        });
});

it('should fail one-to-many relation if is not array (not yet supported)', async function () {
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
                type: `DebugTestTable0`, // one-to-many relation
                // this requires options.debugTestTable0 to have a property with the name `DebugTestTableid`
            },
        ]);
    await options.debugTestTable.init();

    await assert.rejects(
        async () => {
            await orm.validateAllTables();
        });
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
});