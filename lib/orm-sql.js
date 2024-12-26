
const ormChecker = require("./orm-checker");
require('dotenv').config({ path: `../.env.${process.env.NODE_ENV}` });
const mysql = require('mysql');

// transactions
let transactionMode = false;
let numQueriesInTransactionMode = 0;
const MAX_NUM_QUERIES_IN_TRANSACTION_MODE = 100;

const DEBUG_VERBOSE = false;
var connection;

// connect to the MySQL server
var connected = false;

module.exports.sqlQuery = sqlQuery;
async function sqlQuery(queryStr, errorQuietly, ignoreValidity = false) {

    // safety to ensure transaction mode is accidentally left on
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
        console.log(`orm sql:  querying ${queryStr}`);
    }
    return new Promise(resolve => {
        connection.query(queryStr, function (error, results, fields) {
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


async function _enableTransactionMode() {
    // disable autocommit
    const resPromise3 = await sqlQuery(`SET autocommit = 0`, true, true);
    await resPromise3;

    // verify autocommit is disabled
    const resPromise2 = await sqlQuery(`SELECT @@autocommit`, true, true);
    const res2 = await resPromise2;
    if (res2[0]["@@autocommit"] === 0) {
        transactionMode = true;
    } else {
        throw `orm fatal: autocommit should be FALSE but either is true or undetected.`;
    }

    // set stats
    numQueriesInTransactionMode = 0;
}
// only disableTransactionMode is exported as this is the safe, default state the system should be in.
module.exports.disableTransactionMode = disableTransactionMode;
async function disableTransactionMode() {
    // prevent recursion
    numQueriesInTransactionMode = -3;

    // enable autocommit
    const resPromise3 = await sqlQuery(`SET autocommit = 1`, true, true);
    await resPromise3;

    // verify autocommit is enabled
    const resPromise2 = await sqlQuery(`SELECT @@autocommit`, true, true);
    const res2 = await resPromise2;
    if (res2[0]["@@autocommit"] === 1) {
        transactionMode = false;
    } else {
        throw `orm fatal: autocommit should be TRUE but either is false or undetected.`;
    }
}

module.exports.beginTransaction = beginTransaction;
async function beginTransaction() {
    // ASSERT there is no transaction open
    let resPromise = await sqlQuery(`SELECT * FROM INFORMATION_SCHEMA.INNODB_TRX`, true, true);
    let res = await resPromise;
    if (res.length > 0 || transactionMode) {
        throw `orm fatal: cannot begin transaction as there is already an open/uncommitted one`
    }
    await _enableTransactionMode();

    resPromise = await sqlQuery(`START TRANSACTION`, false, true);
    res = await resPromise;
}

module.exports.rollback = rollback;
async function rollback() {
    const resPromise = await sqlQuery(`ROLLBACK`, false, true);
    const res = await resPromise;
    await disableTransactionMode();
}

module.exports.commit = commit;
async function commit() {
    const resPromise = await sqlQuery(`COMMIT`, false, true);
    const res = await resPromise;
    await disableTransactionMode();
}