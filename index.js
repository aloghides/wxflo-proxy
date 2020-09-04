const express = require('express');
const server = express();

//midleware imports
const logger = require('morgan');
const cors = require('cors');
//router imports
const weatherRouter = require('./routers/weather.router');


const port = process.env.PORT || 8080;

server.use(logger('dev'));
server.use(cors());

server.use(weatherRouter);


server.listen(port, () => {
    console.log(`Now listening on port: ${port}`)
})




