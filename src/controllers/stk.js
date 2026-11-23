const axios = require('axios');
const { getAccessToken } = require('./auth');
const { registerTransaction, getTransaction } = require('./callback');

const PRODUCT_CATALOG = {
    'bd-luron': { name: 'Luron', price: 10 },
    'fc-toner': { name: 'Toner', price: 20 },
    'bd-amara': { name: 'Amara Body Lotion', price: 20 },
    'fc-ss': { name: 'Sun Screen', price: 20 },
    'fc-nc': { name: 'Night Cream', price: 20 },
    'fc-dc': { name: 'Day Cream', price: 20 }
};
const SHIPPING_FEES = 30;

function getEnvironment() {
    return (process.env.MPESA_ENVIRONMENT || process.env.MPESA_ENV || 'sandbox').toLowerCase();
}

function normalizePhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (/^0\d{9}$/.test(digits)) return '254' + digits.slice(1);
    if (/^254\d{9}$/.test(digits)) return digits;
    return null;
}

function timestamp() {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return now.getFullYear().toString() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds());
}

async function stkPush(req, res) {
    try {
        const phone = normalizePhone(req.body.phone);
        if (!phone) {
            return res.status(400).json({ error: 'Enter a valid Kenyan phone number.' });
        }

        const items = Array.isArray(req.body.products) ? req.body.products : [];
        if (items.length === 0) {
            return res.status(400).json({ error: 'The order is empty.' });
        }

        let calculatedAmount = SHIPPING_FEES;
        for (const item of items) {
            const product = PRODUCT_CATALOG[item.id];
            const quantity = Number(item.quantity);
            if (!product || !Number.isInteger(quantity) || quantity < 1) {
                return res.status(400).json({ error: 'The cart contains an invalid product or quantity.' });
            }
            calculatedAmount += product.price * quantity;
        }

        const amount = Number(calculatedAmount.toFixed(2));
        const businessShortCode = process.env.MPESA_SHORT_CODE || process.env.MPESA_TILL_NUMBER;
        const partyB = process.env.MPESA_TILL_NUMBER || businessShortCode;
        const passkey = process.env.MPESA_PASSKEY;
        const callbackUrl = process.env.MPESA_CALLBACK_URL;

        if (!businessShortCode || !partyB || !passkey) {
            return res.status(500).json({ error: 'M-Pesa Buy Goods credentials are not configured.' });
        }
        if (!callbackUrl) {
            return res.status(500).json({ error: 'MPESA_CALLBACK_URL is not configured.' });
        }

        const requestTimestamp = timestamp();
        const password = Buffer.from(businessShortCode + passkey + requestTimestamp).toString('base64');
        const accessToken = await getAccessToken();
        const baseUrl = getEnvironment() === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
        const accountReference = ('PREBANA-' + Date.now()).slice(0, 12);

        const response = await axios.post(
            baseUrl + '/mpesa/stkpush/v1/processrequest',
            {
                BusinessShortCode: businessShortCode,
                Password: password,
                Timestamp: requestTimestamp,
                TransactionType: 'CustomerBuyGoodsOnline',
                Amount: Math.round(amount),
                PartyA: phone,
                PartyB: partyB,
                PhoneNumber: phone,
                CallBackURL: callbackUrl,
                AccountReference: accountReference,
                TransactionDesc: 'PreBana order'
            },
            {
                headers: {
                    Authorization: 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        const data = response.data || {};
        if (!data.CheckoutRequestID) {
            return res.status(502).json({ error: data.errorMessage || 'Safaricom did not return a CheckoutRequestID.' });
        }

        try {
            registerTransaction(data.CheckoutRequestID, {
                status: 'pending',
                merchantRequestId: data.MerchantRequestID,
                amount,
                phone,
                resultCode: null,
                resultDescription: 'STK push sent.'
            });
        } catch (error) {
            console.error('M-Pesa accepted the STK request, but the transaction could not be saved:', error);
            return res.status(503).json({
                error: 'The payment request was sent, but its status could not be saved. Check M-Pesa before retrying.',
                checkoutRequestId: data.CheckoutRequestID
            });
        }

        return res.status(200).json({
            message: data.CustomerMessage || 'STK push sent.',
            checkoutRequestId: data.CheckoutRequestID,
            merchantRequestId: data.MerchantRequestID,
            amount
        });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const darajaMessage = error.response && error.response.data
                ? error.response.data.errorMessage || error.response.data.error_description
                : null;
            return res.status(error.response ? error.response.status : 502).json({
                error: darajaMessage || 'Could not initiate the M-Pesa payment.'
            });
        }
        return res.status(500).json({ error: error.message || 'Could not initiate the M-Pesa payment.' });
    }
}

function paymentStatus(req, res) {
    const transaction = getTransaction(req.params.checkoutRequestId);
    if (!transaction) {
        return res.status(404).json({ error: 'Payment transaction not found.' });
    }
    return res.status(200).json(transaction);
}

module.exports = { stkPush, paymentStatus };