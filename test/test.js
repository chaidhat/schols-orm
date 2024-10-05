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


// assume connection is OK already
// cleanup BEFORE running ANY test
// this ensure consistent states
//
// 1. all "DebugTestTable"S will be dropped
async function cleanupTests() {
    const doesTestTableExist = await sqlDoesTableExist("DebugTestTable");
    if (doesTestTableExist) {
        await orm.adminQuery(`DROP TABLE DebugTestTable`);
    }
    for (let i = 0; i < 10; i++) {
        const doesTestTableExist = await sqlDoesTableExist(`DebugTestTable${i}`);
        if (doesTestTableExist) {
            await orm.adminQuery(`DROP TABLE DebugTestTable${i}`);
        }
    }
    assert.equal(await sqlDoesTableExist("DebugTestTable"), false);
}


module.exports.runTests = runTests;
async function runTests() {
    describe('orm parser', function () {
        it('can tokenize', async function () {
            const tokens = orm.tokenize("varchar(24) userId");
            assert.deepEqual(tokens, ["varchar", "(", "24", ")", "userId"])
        });
    });
    describe('orm', function () {
        beforeEach(async function () {
            await cleanupTests();
        });
        afterEach(async function () {
            if (options.debugTestTable !== undefined) {
                await options.debugTestTable.drop();
                options.debugTestTable = undefined;
            }
            if (options.debugTestTable0 !== undefined) {
                await options.debugTestTable0.drop();
                options.debugTestTable0 = undefined;
            }
            if (options.debugTestTable1 !== undefined) {
                await options.debugTestTable1.drop();
                options.debugTestTable1 = undefined;
            }

            await cleanupTests();
        });
        xdescribe('create tests', function () {
            require('./create-tests');
        });
        xdescribe('select tests', function () {
            require('./select-tests');
        });
        xdescribe('insert tests', function () {
            require('./insert-tests');
        });
        xdescribe('update tests', function () {
            require('./update-tests');
        });
        describe('del tests', function () {
            require('./del-tests');
        });
    });
}