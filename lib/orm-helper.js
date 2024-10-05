var assert = require('assert');
const exp = require('constants');

const DATETIME = "$$DATETIME$$";

var mochaTestMode = typeof global.it === 'function';
const VERBOSE_ERRORS = !mochaTestMode; // silent errors if in mocha test mode

const SYMBOLS = ["(", ")", "[", "]", "{", "}"];
const VALID_PRIMITIVES = ["int", "varchar", "mediumtext", "bit", "int", "double", "datetime"];

module.exports.isTokenPrimitive = isTokenPrimitive;
function isTokenPrimitive(token) {
    return VALID_PRIMITIVES.includes(token);
}
function isTokenSymbol(token) {
    return SYMBOLS.includes(token);
}
function isTokenAlphanumeric(token) {
    return !isTokenSymbol(token);
}
function isTokenInt(token) {
    return !isNaN(parseInt(token));
}

// "abc(de) fg" -> ["abc", "(", "de", ")", "fg"]
module.exports.tokenize = tokenize;
function tokenize(code) {
    let index = 0;
    let tokens = [];
    let stack = [];
    while (index < code.length) {
        // when index === code.length, code.charAt(index) will be the last char.
        let currentChar = code.charAt(index);
        switch (currentChar) {
            // whitespace
            case " ":
            case "\n":
            case "\t":
                if (stack.length > 0) {
                    tokens.push(stack.join(""));
                }
                break;
            // symbols
            case "(":
            case ")":
            case "[":
            case "]":
            case "{":
            case "}":
                if (stack.length > 0) {
                    tokens.push(stack.join(""));
                }
                stack = [];
                tokens.push(currentChar);
                break;
            // alphanumerics
            default:
                stack.push(currentChar);
                break;
        }
        index++;
    }
    if (stack.length > 0) {
        tokens.push(stack.join(""));
    }
    return tokens;
}

module.exports.parseType = parseType;
function parseType(type) {
    const tokens = tokenize(type);
    let tokenIdx = 0;

    if (tokens[tokenIdx] === undefined || !isTokenAlphanumeric(tokens[tokenIdx])) {
        throw `orm fatal: parseType() expected datatype but got '${tokens[tokenIdx]}' instead. type: ${type}`;
    }
    // e.g. int
    const dataType = tokens[0];
    let precision = null;
    let isArray = false;

    if (tokenIdx !== tokens.length - 1) {
        tokenIdx++;
        if (tokens[tokenIdx] === "(") {
            // e.g. varchar(256)
            if (tokens[tokenIdx++] === undefined || !isTokenInt(tokens[tokenIdx])) {
                throw `orm fatal: parseType() expected int but got '${tokens[tokenIdx]}' instead. type: ${type}`;
            }
            precision = parseInt(tokens[tokenIdx]);

            if (tokens[tokenIdx++] === undefined || tokens[tokenIdx] !== ")") {
                throw `orm fatal: parseType() expected ')' but got '${tokens[tokenIdx]}' instead. type: ${type}`;
            }
            if (tokenIdx !== tokens.length - 1) {
                tokenIdx++;
                if (tokens[tokenIdx] === "[") {
                    // e.g. varchar(256)[]
                    if (tokens[tokenIdx++] === undefined || tokens[tokenIdx] !== "]") {
                        throw `orm fatal: parseType() expected ']' but got '${tokens[tokenIdx]}' instead. type: ${type}`;
                    }
                    isArray = true;
                } else {
                    throw `orm fatal: parseType() expected '[' but got '${tokens[tokenIdx]}' instead. type: ${type}`;
                }
            }
        } else if (tokens[tokenIdx] === "[") {
            // e.g. int[]
            if (tokens[tokenIdx++] === undefined || tokens[tokenIdx] !== "]") {
                throw `orm fatal: parseType() expected ']' but got '${tokens[tokenIdx]}' instead. type: ${type}`;
            }
            isArray = true;
        }  else {
            throw `orm fatal: parseType() expected '(' or '[' but got '${tokens[tokenIdx]}' instead. type: ${type}`;
        }
    }

    return {
        dataType: dataType,
        precision: precision,
        isArray: isArray,
    }
}

function verifyType(propertyName, propertyShouldBeType, isActuallyType) {
    for (let i = 0; i < isActuallyType.length; i++) {
        // technically this should use parseType BUT for performance, we use this as this type is already validated in checker.js
        if (propertyShouldBeType.split("(")[0] === isActuallyType[i]) {
            // found
            return;
        }
    }
    // not found
    throw `orm fatal: '${propertyName}' expected value to be type '${propertyShouldBeType}' but got '${isActuallyType.join(" or ")}' instead.`;
}

module.exports.logError = logError;
function logError(err) {
    if (VERBOSE_ERRORS) {
        console.log(err);
    }
}

module.exports.assertType = assertType;
function assertType(propertyName, input, shouldBeType) {

    if (input === null) {
        return;
    } else if (input === DATETIME) {
        verifyType(propertyName, shouldBeType, ["datetime"]);
    } else if (typeof input === "string") {
        if (input === "true" || input === "false") {
            //console.log(`orm warning: implicit cast for ${propertyName} from varchar to bool`);
            verifyType(propertyName, shouldBeType, ["varchar", "mediumtext", "bit"]);
        } else if (!isNaN(parseFloat(input))) {
            //console.log(`orm warning: implicit cast for ${propertyName} from varchar to int`);
            verifyType(propertyName, shouldBeType, ["varchar", "mediumtext", "int", "double"]);
        } else {
            verifyType(propertyName, shouldBeType, ["varchar", "mediumtext"]);
        }
    } else if (typeof input === "boolean") {
        verifyType(propertyName, shouldBeType, ["bit"]);
    } else {
        if (input === 0 || input === 1) {
            verifyType(propertyName, shouldBeType, ["bit", "int", "double"]);
        } else {
            verifyType(propertyName, shouldBeType, ["int", "double"]);
        }
    }
}
// wraps a string around strings
module.exports.sanitizeSqlValue = sanitizeSqlValue;
function sanitizeSqlValue(input) {

    // special for datetimes
    if (input === null) {
        return 'NULL';
    }

    if (input === DATETIME) {
        return `CURRENT_TIMESTAMP`;
    }

    if (typeof input === "string") {
        // implicit case to bool
        if (input === "true") {
            return '1';
        }
        if (input === "false") {
            return '0';
        }

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