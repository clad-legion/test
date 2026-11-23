const transactions = new Map();

function registerTransaction(checkoutRequestId, transaction) {
    transactions.set(checkoutRequestId, transaction);
}

function getTransaction(checkoutRequestId) {
    return transactions.get(checkoutRequestId);
}

function mpesaCallback(req, res) {
    const callback = req.body && req.body.Body
        ? req.body.Body.stkCallback
        : null;

    if (!callback) {
        return res.status(400).json({
            ResultCode: 1,
            ResultDesc: 'Invalid M-Pesa callback.'
        });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    if (!checkoutRequestId) {
        return res.status(400).json({
            ResultCode: 1,
            ResultDesc: 'CheckoutRequestID is missing.'
        });
    }

    const items = callback.CallbackMetadata && Array.isArray(callback.CallbackMetadata.Item)
        ? callback.CallbackMetadata.Item
        : [];
    const values = {};

    for (const item of items) {
        if (item && item.Name) {
            values[item.Name] = item.Value;
        }
    }

    const existing = transactions.get(checkoutRequestId) || {};
    transactions.set(checkoutRequestId, {
        ...existing,
        merchantRequestId: callback.MerchantRequestID,
        status: callback.ResultCode === 0 ? 'completed' : 'failed',
        resultCode: callback.ResultCode,
        resultDescription: callback.ResultDesc,
        mpesaReceiptNumber: values.MpesaReceiptNumber || null,
        transactionDate: values.TransactionDate || null,
        amountPaid: values.Amount != null ? Number(values.Amount) : null,
        phonePaid: values.PhoneNumber ? String(values.PhoneNumber) : null
    });

    return res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Accepted'
    });
}

module.exports = {
    mpesaCallback,
    registerTransaction,
    getTransaction
};