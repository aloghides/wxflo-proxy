//Express
const Router = require('express');
const router = Router();

//Axios
const axios = require('axios');
axios.defaults.headers.common['User-Agent'] = '(dev weather app, adam.m.loghides@gmail.com)';

//Nodemon
//const { reset } = require('nodemon');

//Mapbox Geolocation
//const { apiKey, mapboxAPIKey } = require('../credentials');
//const apiKey = process.env.API_KEY || require('../credentials').apiKey;
const mapboxAPIKey = process.env.MAPBOX_API_KEY 
//|| require('../credentials').mapboxAPIKey;
const mbxClient = require('@mapbox/mapbox-sdk');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const baseClient = mbxClient({ accessToken: mapboxAPIKey });
const geocodingService = mbxGeocoding(baseClient);


//API Path Examples
//https://api.weather.gov/points/{latitude},{longitude}
//https://api.weather.gov/gridpoints/MPX/121,75
//https://api.weather.gov/gridpoints/MPX/121,75/forecast
//https://api.weather.gov/gridpoints/MPX/121,75/forecast/hourly



//geocode
router.get('/geo/location/:location', (req, res) => {

    geocodingService.forwardGeocode({
        query: req.params.location,
        limit: 1
      }).send()
        .then(response => response.body)
        .then(geoResponse => res.status(200).send(geoResponse))
        .catch(err => console.log(err));
          
})

// metadata by location
router.get('/metadata/location/:location', (req, res) => {

    geocodingService.forwardGeocode({
        query: req.params.location,
        limit: 1
      }).send()
        .then(response => response.body)
        .then(locationData => {
            const lat = locationData.features[0].geometry.coordinates[1];
            const lon = locationData.features[0].geometry.coordinates[0];
            const base = 'https://api.weather.gov/points';
            const metadataURL = `${base}/${lat},${lon}`;
            console.log(metadataURL);
            return axios.get(metadataURL);
        })
        .then(metaDataResponse => res.status(200).json(metaDataResponse.data))
        .catch(err => console.log(err));
          
})

// location based combined forecast data - only need to lookup metadata once with combined request
router.get('/forecast/location/:location', (req, res) => {

    geocodingService.forwardGeocode({
        query: req.params.location,
        limit: 1
      }).send()
        .then(response => response.body)
        .then(locationData => {
            const lat = locationData.features[0].geometry.coordinates[1];
            const lon = locationData.features[0].geometry.coordinates[0];
            const base = 'https://api.weather.gov/points';
            const metadataURL = `${base}/${lat},${lon}`;
            console.log(metadataURL);
            return axios.get(metadataURL);
        })
        .then(metaData => {
            return axios.all([
                axios.get(metaData.data.properties.forecast),
                axios.get(metaData.data.properties.forecastHourly),
                axios.get(metaData.data.properties.forecastGridData)
            ])
        })
        .then(
            weatherReponse => {
                const forecast = weatherReponse[0].data
                const forecastHourly = weatherReponse[1].data
                const forecastGridData = weatherReponse[2].data
                res.status(200).json({
                    forecast,
                    forecastHourly,
                    forecastGridData
                })
            })
        .catch(err => console.log(err));
          
})


// locaiton based - Current Observations 
router.get('/obs/location/:location', (req, res) => {

    geocodingService.forwardGeocode({
        query: req.params.location,
        limit: 1
      }).send()
        .then(response => response.body)
        .then(locationData => {
            const lat = locationData.features[0].geometry.coordinates[1];
            const lon = locationData.features[0].geometry.coordinates[0];
            const base = 'https://api.weather.gov/points';
            const metadataURL = `${base}/${lat},${lon}`;
            console.log(metadataURL);
            return axios.get(metadataURL);
        })
        .then(metaData => {
            return axios.get(metaData.data.properties.observationStations);
        })
        .then(stationResponse => {
            const obsPath = '/observations/latest'
            return axios.get(`${stationResponse.data.features[0].id}${obsPath}`)
        })
        .then(obsReponse => res.status(200).json(obsReponse.data))
        .catch(err => console.log(err));
          
})




// do all by location
router.get('/weather/location/:location', (req, res) => {

    geocodingService.forwardGeocode({
        query: req.params.location,
        limit: 1
      }).send()
        .then(response => response.body)
        .then(locationData => {
            const lat = locationData.features[0].geometry.coordinates[1];
            const lon = locationData.features[0].geometry.coordinates[0];
            const base = 'https://api.weather.gov/points';
            const metadataURL = `${base}/${lat},${lon}`;
            console.log(metadataURL);
            return axios.get(metadataURL);
        })
        .then(metaData => {
            const meta = metaData.data;
            return axios.all([
                axios.get(metaData.data.properties.forecast),
                axios.get(metaData.data.properties.forecastHourly),
                axios.get(metaData.data.properties.forecastGridData),
                axios.get(metaData.data.properties.observationStations),
                meta
            ])
        })
        .then(
            weatherReponse => {
                const obsPath = '/observations/latest';
                const forecast = weatherReponse[0].data;
                const forecastHourly = weatherReponse[1].data;
                const forecastGridData = weatherReponse[2].data;
                const meta = weatherReponse[4]
                return axios.all([
                    forecast,
                    forecastHourly,
                    forecastGridData,
                    axios.get(`${weatherReponse[3].data.features[0].id}${obsPath}`),
                    meta
                ])
            })
        .then(combinedResponse => {
            const forecast = combinedResponse[0];
            const forecastHourly = combinedResponse[1];
            const forecastGridData = combinedResponse[2];
            const obsData = combinedResponse[3].data;
            const meta = combinedResponse[4];
            res.status(200).json({
                forecast,
                forecastHourly,
                forecastGridData,
                obsData,
                meta
            })
        })
        .catch(err => res.status(418).send(err));

})


// do all by position
router.get('/weather/position/:lat,:lon', (req, res) => {
    
    const lat = req.params.lat;
    const lon = req.params.lon;
    const base = 'https://api.weather.gov/points';
    const metadataURL = `${base}/${lat},${lon}`;
    console.log(metadataURL);
    axios.get(metadataURL)
        .then(metaData => {
            const meta = metaData.data;
            return axios.all([
                axios.get(metaData.data.properties.forecast),
                axios.get(metaData.data.properties.forecastHourly),
                axios.get(metaData.data.properties.forecastGridData),
                axios.get(metaData.data.properties.observationStations),
                meta
            ])
        })
        .then(
            weatherReponse => {
                const obsPath = '/observations/latest';
                const forecast = weatherReponse[0].data;
                const forecastHourly = weatherReponse[1].data;
                const forecastGridData = weatherReponse[2].data;
                const meta = weatherReponse[4]
                return axios.all([
                    forecast,
                    forecastHourly,
                    forecastGridData,
                    axios.get(`${weatherReponse[3].data.features[0].id}${obsPath}`),
                    meta
                ])
            })
        .then(combinedResponse => {
            const forecast = combinedResponse[0];
            const forecastHourly = combinedResponse[1];
            const forecastGridData = combinedResponse[2];
            const obsData = combinedResponse[3].data;
            const meta = combinedResponse[4];
            res.status(200).json({
                forecast,
                forecastHourly,
                forecastGridData,
                obsData,
                meta
            })
        })
        .catch(err => res.status(500).send(err));

})







module.exports = router;
