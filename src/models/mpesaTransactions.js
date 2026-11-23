const fs = require('fs');
const path = require('path');

const dataDirectory = process.env.MPESA_DATA_DIR
    ? path.resolve(process.env.MPESA_DATA_DIR)
    : path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDirectory, 'mpesa-transactions.json');
const mpesaEnvironment = (process.env.MPESA_ENVIRONMENT || process.env.MPESA_ENV || '').toLowerCase();

if (mpesaEnvironment === 'production' && !process.env.MPESA_DATA_DIR) {
    console.warn('MPESA_DATA_DIR is unset; M-Pesa transaction data may be lost when the service restarts.');
}

fs.mkdirSync(dataDirectory, { recursive: true });

function loadTransactions() {
    if (!fs.existsSync(dataFile)) {
        return new Map();
    }

    let records;
    try {
        records = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch (error) {
        throw new Error('Could not read saved M-Pesa transactions from ' + dataFile + ': ' + error.message);
    }

    if (!Array.isArray(records) || records.some(record =>
        !Array.isArray(record) ||
        record.length !== 2 ||
        typeof record[0] !== 'string' ||
        !record[1] ||
        typeof record[1] !== 'object'
    )) {
        throw new Error('Saved M-Pesa transaction data is invalid: ' + dataFile);
    }

    return new Map(records);
}

const transactions = loadTransactions();

function saveTransactions() {
    const temporaryFile = dataFile + '.' + process.pid + '.tmp';
    fs.writeFileSync(temporaryFile, JSON.stringify(Array.from(transactions.entries())), 'utf8');
    fs.renameSync(temporaryFile, dataFile);
}

function saveTransaction(checkoutRequestId, transaction) {
    const previous = transactions.get(checkoutRequestId);
    transactions.set(checkoutRequestId, transaction);

    try {
        saveTransactions();
    } catch (error) {
        if (previous) {
            transactions.set(checkoutRequestId, previous);
        } else {
            transactions.delete(checkoutRequestId);
        }
        throw error;
    }
}

function getTransaction(checkoutRequestId) {
    return transactions.get(checkoutRequestId);
}

module.exports = { getTransaction, saveTransaction };
