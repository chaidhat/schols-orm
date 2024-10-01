
const ormChecker = require("./checker");
require('dotenv').config({ path: `../.env.${process.env.NODE_ENV}` });
const mysql = require('mysql');

const DEBUG_VERBOSE = false;
var connection;

// connect to the MySQL server
var connected = false;

module.exports.sqlQuery = sqlQuery;
async function sqlQuery(queryStr, errorQuietly, ignoreValidity = false) {
    while (!ignoreValidity && !ormChecker.getValidity()) {
        await ormChecker.validateAllTables();
    }
    await _sqlConnect();
    if (DEBUG_VERBOSE) {
        console.log(`DATABASE:  querying ${queryStr}`);
    }
    return new Promise(resolve => {
        connection.query(queryStr, function (error, results, fields) {
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