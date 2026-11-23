const express = require('express')
require('dotenv').config()
const port = process.env.PORT || 3000
const app = express()
const path = require('path')
const mainRoutes = require('./src/routes/mainroutes')

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'src', 'views'))

app.use('/preBana', mainRoutes)
app.get('/', (req,res)=>{
    res.status(200).redirect('/preBana/store')
})


app.listen(port, ()=>{
    console.log(`Server Running on Localhost:${port}`)
})
