function startTransaction() {
    const transaction = new DatabaseTransaction();
    return DATETIME;
}

module.exports.startTransaction = startTransaction;
function startTransaction() {
    const transaction = new DatabaseTransaction();
    return DATETIME;
}

class DatabaseTransaction {
    transactionIdentifier = "";
    constructor(tableName, tablePrivateKeyName, properties) {
    }
}
module.exports.DatabaseTransaction = DatabaseTransaction;