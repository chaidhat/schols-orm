import mocha from 'mocha';
const it = mocha.it;

import common from "./common";
const options = common.options;
const assert = common.assert;
const orm = common.orm;

// import helper functions
// const randomStr = common.randomStr;
// const randomInt = common.randomInt;
const sqlDoesTableExist = common.sqlDoesTableExist;
// const sqlDoesColumnNameExistInTable = common.sqlDoesColumnNameExistInTable;
// const sqlIsColumnRightDataType = common.sqlIsColumnRightDataType;

it('can create a transaction without affecting previous data', async function () {
    // steps: 
    // 1. we will create a table
    // 2. we start a transaction
    // 3. confirm that table we create pre-transaction is still there
    // 4. rollback the transaction
    // 5. confirm that table we create pre-transaction is still there

    // 1. we will create a table
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
    ]);
    await options.debugTestTable.init();
    assert.ok(await sqlDoesTableExist("DebugTestTable"));

    // there is no transaction open
    let resPromise = await orm.sqlQuery(`SELECT * FROM INFORMATION_SCHEMA.INNODB_TRX`, true, true);
    let res = await resPromise;
    assert.equal(
        res.length,
        0
    );
    // verify autocommit is enabled
    let resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    let res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 1);

    // 2. we start a transaction
    await orm.beginTransaction();
    // verify autocommit is disabled
    resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 0);

    // 3. confirm that table we create pre-transaction is still there
    assert.ok(await sqlDoesTableExist("DebugTestTable"));

    // 4. rollback the transaction
    await orm.rollback();
    // verify autocommit is enabled
    resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 1);

    // 5. confirm that table we create pre-transaction is still there
    assert.ok(await sqlDoesTableExist("DebugTestTable"));
});
it('can rollback a transaction', async function () {
    // steps: 
    // 1. create a table
    // 2. start a transaction
    // 3. insert into table
    // 4. confirm insertion is in table
    // 5. rollback the transaction
    // 6. confirm insertion is not in table

    // 1. we will create a table
    options.debugTestTable = new orm.DatabaseTable(`DebugTestTable`,
        "debugTestTableId",
        [
            {
                name: "a",
                type: "int"
            },
    ]);
    await options.debugTestTable.init();

    // verify autocommit is enabled
    let resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    let res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 1);
    // verify no entries in table
    let res = await options.debugTestTable.select();
    assert.equal(
        res.length, 
        0
    );

    // 2. we start a transaction
    await orm.beginTransaction();
    // verify autocommit is disabled
    resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 0);

    // 3. we will insert into table
    await options.debugTestTable.insertInto({a: 2})

    // 4. confirm insertion is in table
    res = await options.debugTestTable.select();
    assert.equal(
        res.length, 
        1
    );

    // 5. rollback the transaction
    await orm.rollback();
    // verify autocommit is enabled
    resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 1);

    // 6. confirm insertion is not in table
    res = await options.debugTestTable.select();
    assert.equal(
        res.length, 
        0
    );
});
it('can commit a transaction', async function () {
    // steps: 
    // 1. create a table
    // 2. start a transaction
    // 3. insert into table
    // 4. confirm insertion is in table
    // 5. commit the transaction
    // 6. confirm insertion is in table

    // 1. we will create a table
    options.debugTestTable = new orm.DatabaseTable(`DebugTestTable`,
        "debugTestTableId",
        [
            {
                name: "a",
                type: "int"
            },
    ]);
    await options.debugTestTable.init();

    // verify autocommit is enabled
    let resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    let res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 1);
    // verify no entries in table
    let res = await options.debugTestTable.select();
    assert.equal(
        res.length, 
        0
    );

    // 2. we start a transaction
    await orm.beginTransaction();
    // verify autocommit is disabled
    resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 0);

    // 3. we will insert into table
    await options.debugTestTable.insertInto({a: 2})

    // 4. confirm insertion is in table
    res = await options.debugTestTable.select();
    assert.equal(
        res.length, 
        1
    );

    // 5. commit the transaction
    await orm.commit();
    // verify autocommit is enabled
    resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 1);

    // 6. confirm insertion is in table
    res = await options.debugTestTable.select();
    assert.equal(
        res.length, 
        1
    );
});
it('can safely auto exit if transaction is not exited', async function () {
    // steps: 
    // 1. create a table
    // 2. start a transaction
    // 3. insert AMOUNT_TO_INSERT elements into table
    const AMOUNT_TO_INSERT = 300;
    //    this should exceed the transaction limit and cause it to safely commit as if the transaction occurred
    // 4. confirm transaction mode is not active
    // 5. confirm insertion is in table

    // 1. create a table
    options.debugTestTable = new orm.DatabaseTable(`DebugTestTable`,
        "debugTestTableId",
        [
            {
                name: "a",
                type: "int"
            },
    ]);
    await options.debugTestTable.init();

    // verify autocommit is enabled
    let resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    let res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 1);
    // verify no entries in table
    let res = await options.debugTestTable.select();
    assert.equal(
        res.length, 
        0
    );

    // 2. start a transaction
    await orm.beginTransaction();
    // verify autocommit is disabled
    resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 0);

    // 3. insert AMOUNT_TO_INSERT elements into table
    for (let i = 0; i < AMOUNT_TO_INSERT; i++) {
        await options.debugTestTable.insertInto({a: i})
    }

    // 4. confirm transaction mode is not active
    // verify autocommit is enabled
    resPromise2 = await orm.sqlQuery(`SELECT @@autocommit`, true, true);
    res2 = await resPromise2;
    assert.equal(res2[0]["@@autocommit"], 1);

    // 5. confirm insertion is in table
    res = await options.debugTestTable.select();
    assert.equal(
        res.length, 
        AMOUNT_TO_INSERT
    );
});