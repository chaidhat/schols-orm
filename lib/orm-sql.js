
import ormChecker from "./orm-checker";
import dotenv from "dotenv";
import mysql from "mysql";

dotenv.config({ path: `../.env.${process.env.NODE_ENV}` });

// transactions
let transactionMode = false;
let transactionModeStackTrace = null; // the function that enabled the transaction mode should set this stack
let numQueriesInTransactionMode = 0;
const MAX_NUM_QUERIES_IN_TRANSACTION_MODE = 100; // after this many queries, transaction mode will be disabled
const TIMEOUT_AFTER_N_ATTEMPTS = 10;

const DEBUG_VERBOSE = false;
var connection;

// connect to the MySQL server
var connected = false;

// insert lock prevents concurrent inserts
let insertLock = {};
module.exports.insertLock = insertLock;

module.exports.sqlQuery = sqlQuery;
async function sqlQuery(queryStr, errorQuietly, ignoreValidity = false) {

    // safety to ensure transaction mode isn't accidentally left on
    if (transactionMode) {
        numQueriesInTransactionMode++;
    }
    if (transactionMode && numQueriesInTransactionMode > MAX_NUM_QUERIES_IN_TRANSACTION_MODE) {
        console.log("orm warning: number of queries in transaction mode too high! Exiting transaction mode now!")
        await disableTransactionMode();
    }
    while (!ignoreValidity && !ormChecker.getValidity()) {
        await ormChecker.validateAllTables();
    }
    await _sqlConnect();
    if (DEBUG_VERBOSE) {
        if (queryStr.length < 200) {
            console.log(`orm sql:  querying ${queryStr}`);
        } else {
            console.log(`orm sql:  querying ${queryStr.substring(0, 200)}... (truncated)`);
        }
    }
    return new Promise(resolve => {
        connection.query(queryStr, function (error, results) {
            if (error) {
                console.log(`orm sql error: ${queryStr}`)
            }
            if (!errorQuietly) {
                if (error) throw error;
            } else {
                if (error) resolve(error);
            }
            resolve(results);
        });
    });
}

function _sqlConnect() {
    //console.log("connecting...")
    if (connected) {  // if already connected
        //console.log("already conencted...")
        return Promise.resolve();
    }
    connected = true; // TODO: make this atomic
    // handshake
    connection = mysql.createConnection({
        host     : process.env.MYSQL_HOSTNAME, 
        database : process.env.MYSQL_DBNAME, 
        user     : process.env.MYSQL_USER, 
        port     : process.env.MYSQL_PORT, 
        password : process.env.MYSQL_PASS
    });
    // then perform connection
    return new Promise(resolve => {
        connection.connect((err) => {
            if (err) {
                connected = false;
                console.log(err.message);
                throw err;
            }
            resolve();
        });
    });
}

// disconnect from the MySQL server
/*
function _sqlDisconnect() {
    if (!connected)  // if already disconnected
        return Promise.resolve();

    // terminate connection to server
    return new Promise(resolve => {
        connection.end((err) => {
            if (err) {
                console.log(err.message);
                throw err;
            }
            connected = false;
            resolve();
        });
    });
}
*/


async function _enableTransactionMode() {
    let tries = 0;
    do {
        // disable autocommit
        const resPromise3 = await sqlQuery(`SET autocommit = 0`, true, true);
        await resPromise3;

        // verify autocommit is disabled
        const resPromise2 = await sqlQuery(`SELECT @@autocommit`, true, true);
        const res2 = await resPromise2;
        const autocommitEnabled = res2[0]["@@autocommit"] === 1;
        // note: autocommit should be DISABLED for transaction mode to be enabled
        if (!autocommitEnabled) {
            // enter transaction mode
            transactionMode = true;
            transactionModeStackTrace = new Error()
                .stack
                .split("\n")
                .slice(2) // Skip the first two lines to exclude "Error" and this function.
                .join("\n");
            numQueriesInTransactionMode = 0;
            return;
        }
    }
    while (tries++ < TIMEOUT_AFTER_N_ATTEMPTS);
    throw `orm fatal: autocommit should be FALSE but either is true or undetected.`;

}
// only disableTransactionMode is exported as this is the safe, default state the system should be in.
module.exports.disableTransactionMode = disableTransactionMode;
async function disableTransactionMode() {
    let attempts = 0;
    numQueriesInTransactionMode = -100; // set this to avoid any limits
    do {
        // disable autocommit
        const resPromise3 = await sqlQuery(`SET autocommit = 1`, true, true);
        await resPromise3;

        // verify autocommit is disabled
        const resPromise2 = await sqlQuery(`SELECT @@autocommit`, true, true);
        const res2 = await resPromise2;
        const autocommitEnabled = res2[0]["@@autocommit"] === 1;
        // note: autocommit should be DISABLED for transaction mode to be enabled
        if (autocommitEnabled) {
            // exit transaction mode
            transactionMode = false;
            numQueriesInTransactionMode = 0;
            return;
        }
    }
    while (attempts++ < TIMEOUT_AFTER_N_ATTEMPTS);
    throw `orm fatal: autocommit should be TRUE but either is true or undetected.`;
}

module.exports.beginTransaction = beginTransaction;
async function beginTransaction() {
    // ASSERT there is no transaction open

    let attempts = 0;
    do {
        numQueriesInTransactionMode--; // the new query doesn't count
        let resPromise = await sqlQuery(`SELECT * FROM INFORMATION_SCHEMA.INNODB_TRX`, true, true);
        let res = await resPromise;
        if (res.length === 0 && !transactionMode) {
            // lock is acquired
            await _enableTransactionMode();

            resPromise = await sqlQuery(`START TRANSACTION`, false, true);
            res = await resPromise;
            return;
        }
        // assert fail, spin lock until the lock is released
        // await 500 ms
        await (new Promise(resolve => setTimeout(resolve, 500)));
    } while (attempts++ < TIMEOUT_AFTER_N_ATTEMPTS);
    throw `orm fatal: cannot begin transaction as there is already an open/uncommitted one. Stack trace at ${transactionModeStackTrace}`
}

module.exports.rollback = rollback;
async function rollback() {
    const resPromise = await sqlQuery(`ROLLBACK`, false, true);
    await resPromise;
    await disableTransactionMode();
}

module.exports.commit = commit;
async function commit() {
    const resPromise = await sqlQuery(`COMMIT`, false, true);
    await resPromise;
    await disableTransactionMode();
}