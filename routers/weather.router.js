//Express
const Router = require('express');
const router = Router();

//Axios
const axios = require('axios');
axios.defaults.headers.common['User-Agent'] = '(dev weather app, adam.m.loghides@gmail.com)';

//Nodemon
//const { reset } = requireIfExists('nodemon');

//Mapbox Geolocation
//const { mapboxAPIKey, azureWeatherKey } = require('../credentials');
const mapboxAPIKey = process.env.MAPBOX_API_KEY;
const mbxClient = require('@mapbox/mapbox-sdk');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const baseClient = mbxClient({ accessToken: mapboxAPIKey });
const geocodingService = mbxGeocoding(baseClient);

//AzureWeather
const azWeatherBase = 'https://atlas.microsoft.com/weather/currentConditions/json?api-version=1.0';
const azureWeatherKey = process.env.API_AZ_WEATHERKEY;

//NWS Production Weather Service - params: lat=45.055&lon=-92.8101&unit=0&lg=english&FcstType=json
const nwsBaseURL = 'https://forecast.weather.gov/MapClick.php?'

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
            const azureWeatherURL = `${azWeatherBase}&query=${lat},${lon}&subscription-key=${azureWeatherKey}`;
            console.log(azureWeatherURL);
            return axios.get(azureWeatherURL);
        })
        .then(obsReponse => {
            const obsData = obsReponse.data.results;
            res.status(200).json({obsData});
        })
        .catch(err => console.log(err));
          
})

// do all by location using NWS for current
// the current observations endpoint on NWS API is not fully operation and prone to missing data
// it is also slowwwwwwwww                                                                          NWS Experimental
// ====================================================================================================================
router.get('/weather/locationNWS/:location', (req, res) => {

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

// do all by position using NWS Obs
// the current observations endpoint on NWS API is not fully operation and prone to missing data
// it is also slowwwwwwwww
router.get('/weather/positionOLD/:lat,:lon', (req, res) => {
    
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


// do all by position using Azure Weather       AZURE Weather
// ==================================================================
router.get('/weather/positionAzure/:lat,:lon', (req, res) => {
    
    const lat = req.params.lat;
    const lon = req.params.lon;
    const base = 'https://api.weather.gov/points';
    const metadataURL = `${base}/${lat},${lon}`;
    console.log(metadataURL);
    axios.get(metadataURL)
        .then(metaData => {
            const azureWeatherURL = `${azWeatherBase}&query=${lat},${lon}&subscription-key=${azureWeatherKey}`;
            const meta = metaData.data;
            return axios.all([
                axios.get(metaData.data.properties.forecast),
                axios.get(metaData.data.properties.forecastHourly),
                axios.get(azureWeatherURL),
                meta
            ])
        })
        .then(combinedResponse => {
            const forecast = combinedResponse[0].data;
            const forecastHourly = combinedResponse[1].data;
            const obsData = combinedResponse[2].data.results;
            const meta = combinedResponse[3];
            res.status(200).json({
                forecast,
                forecastHourly,
                obsData,
                meta
            })
        })
        .catch(err => res.status(500).send(err));

})


// do all by location azure weather current
router.get('/weather/locationAzure/:location', (req, res) => {
    console.log('test');
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
            const azureWeatherURL = `${azWeatherBase}&query=${lat},${lon}&subscription-key=${azureWeatherKey}`;
            console.log(azureWeatherURL);
            console.log(metadataURL);
            return axios.all([
                axios.get(metadataURL),
                axios.get(azureWeatherURL)
            ]);
        })
        .then(locationResponse => {
            const metaData = locationResponse[0].data;
            const obsData = locationResponse[1].data.results;
            return axios.all([
                axios.get(metaData.properties.forecast),
                axios.get(metaData.properties.forecastHourly),
                obsData,
                metaData
            ]);
        })
        .then(combinedResponse => {
            const forecast = combinedResponse[0].data;
            const forecastHourly = combinedResponse[1].data;
            const obsData = combinedResponse[2];
            const meta = combinedResponse[3];
            res.status(200).json({
                forecast,
                forecastHourly,
                obsData,
                meta
            })
            console.log('test2');
        })
        .catch(err => res.status(500).send(err));
})


// do all by position                                              NWS Operational
// =========================================================================================
router.get('/weather/position/:lat,:lon', (req, res) => {
    
    const lat = req.params.lat;
    const lon = req.params.lon;
    const base = 'https://api.weather.gov/points';
    const metadataURL = `${base}/${lat},${lon}`;
    console.log(metadataURL);
    axios.get(metadataURL)
        .then(metaData => {
            const nwsURL =  `${nwsBaseURL}lat=${lat}&lon=${lon}&unit=0&lg=english&FcstType=json`
            const meta = metaData.data;
            return axios.all([
                axios.get(metaData.data.properties.forecast),
                axios.get(metaData.data.properties.forecastHourly),
                axios.get(nwsURL),
                meta
            ])
        })
        .then(combinedResponse => {
            const forecast = combinedResponse[0].data;
            const forecastHourly = combinedResponse[1].data;
            const obsData = combinedResponse[2].data;
            const meta = combinedResponse[3];
            res.status(200).json({
                forecast,
                forecastHourly,
                obsData,
                meta
            })
        })
        .catch(err => res.status(500).send(err));

})


// do all by location weather current
router.get('/weather/location/:location', (req, res) => {
    console.log('test');
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
            const nwsURL =  `${nwsBaseURL}lat=${lat}&lon=${lon}&unit=0&lg=english&FcstType=json`;
            console.log(nwsURL);
            console.log(metadataURL);
            return axios.all([
                axios.get(metadataURL),
                axios.get(nwsURL)
            ]);
        })
        .then(locationResponse => {
            const metaData = locationResponse[0].data;
            const obsData = locationResponse[1].data;
            return axios.all([
                axios.get(metaData.properties.forecast),
                axios.get(metaData.properties.forecastHourly),
                obsData,
                metaData
            ]);
        })
        .then(combinedResponse => {
            const forecast = combinedResponse[0].data;
            const forecastHourly = combinedResponse[1].data;
            const obsData = combinedResponse[2];
            const meta = combinedResponse[3];
            res.status(200).json({
                forecast,
                forecastHourly,
                obsData,
                meta
            })
            console.log('test2');
        })
        .catch(err => res.status(500).send(err));
})

module.exports = router;