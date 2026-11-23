const express = require('express')
const { stkPush, paymentStatus } = require('../controllers/stk')
const { mpesaCallback } = require('../controllers/callback')
const router = express.Router()

const products = [
    { name: 'Luron', id: 'bd-luron', price: 10 },
    { name: 'Toner', id: 'fc-toner', price: 20 },
    { name: 'Amara Body Lotion', id: 'bd-amara', price: 20 },
    { name: 'Sun Screen', id: 'fc-ss', price: 20 },
    { name: 'Night Cream', id: 'fc-nc', price: 20 },
    { name: 'Day Cream', id: 'fc-dc', price: 20 }
]


router.get(['/store', '/shop/home'], (req, res) => {
    res.status(200).render('client/store', { products })
})

router.get('/cart', (req, res) => {
    res.status(200).render('client/includes/cart')
})

router.get('/checkout', (req, res) => {
    res.status(200).render('client/includes/chck2')
})

router.get('/payment', (req, res) => {
    res.status(200).render('client/includes/payment')
})

router.get(['/finalrecipt', '/finalreceipt', '/shop/finalrecipt'], (req, res) => {
    res.status(200).render('client/includes/finalrecipt')
})

router.post('/payment/stk', stkPush)
router.post('/payment/callback', mpesaCallback)
router.get('/payment/status/:checkoutRequestId', paymentStatus)
router.use((req,res)=>{
    res.status(404).render('404')
})

module.exports = router;