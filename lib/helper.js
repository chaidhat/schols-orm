const DATETIME = "$$DATETIME$$";

// wraps a string around strings
module.exports.sanitizeSqlValue = sanitizeSqlValue;
function sanitizeSqlValue(input) {

    // special for datetimes
    if (input === null)
        return 'NULL';

    if (input === DATETIME)
        return `CURRENT_TIMESTAMP`;

    if (typeof input === "string") {
        // just to be safe!
        return `"${encodeURI(input)}"`;
    } else if (typeof input === "boolean") {
        if (input) {
            return '1';
        } else {
            return '0';
        }
    } else {
        return `${input}`;
    }
}

module.exports.getDatetime = getDatetime;
function getDatetime() {
    return DATETIME;
}

module.exports.readBool = readBool;
function readBool(input) {
    if (typeof input === "boolean") {
        return input;
    }
    let output = input.readInt8();
    if (output === 1) {
        return true;
    } else if (output === 0) {
        return false;
    } else {
        throw "not a bool!";
    }
}