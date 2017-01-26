// Load environment vars from .env
require('dotenv').config({silent: true});

// Opbeat init
/*var opbeat = require('opbeat').start({
  appId: '***',
  organizationId: '***',
  secretToken: '***'
});*/

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

// Code to run if we're in the master process
if (cluster.isMaster && process.env.NODE_ENV != "development") {
    // Create a worker for each CPU
    for (var i = 0; i < numCPUs; i += 1) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log('worker ${worker.process.pid} died');
    });
}
// work work work work work (worker process)
else {
var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var S3Adapter = require('parse-server').S3Adapter;
var ParseDashboard = require('parse-dashboard');

//var LoggerAdapter = require('parse-server/lib/Adapters/Logger/LoggerAdapter.js').LoggerAdapter;
//var winston = require('winston');
//winston.level = 'warn';

var app = express();
app.set('trust proxy', 'loopback');

if (!process.env.DATABASE_URI) {
  throw new Error('You must specify a database path. Bye');
}

console.log('Launching parse-server!');

/** 
* SETTINGS
*/

var dashboard = new ParseDashboard({
  // Parse Dashboard settings
  "apps": [
    {
      "serverURL":      process.env.PARSE_DASHBOARD_SERVER_URL || process.env.SERVER_URL, 
      "appId":          process.env.APP_ID,
      "masterKey":      process.env.MASTER_KEY,
      "javascriptKey":  process.env.JAVASCRIPT_KEY,
      "restKey":        process.env.REST_KEY,
      "appName":        process.env.APP_NAME,
      "iconName":       "favicon@2x.png", 
      "production":     true //It looks like this flag is broken, force off... app.get('env') === "development" ? false : true
    }
  ],
  "iconsFolder": "icons",
  "users": [
     {
       "user": process.env.PARSE_DASHBOARD_USER,
       "pass": process.env.PARSE_DASHBOARD_PASS
     },
     {
       "user": process.env.APP_ID,
       "pass": process.env.MASTER_KEY
     }
  ]
}, true); //allowInsecure: true

/* Setup parse server */
var api = new ParseServer({
  databaseURI:    process.env.DATABASE_URI || 'mongodb://localhost:27017',
  cloud:          __dirname + '/cloud/main.js',
  appId:          process.env.APP_ID,
  masterKey:      process.env.MASTER_KEY,
  fileKey:        process.env.FILE_KEY,
  serverURL:      process.env.SERVER_URL,		      
  restAPIKey:     process.env.REST_KEY,
  clientKey:      process.env.CLIENT_KEY,
  javascriptKey:  process.env.JAVASCRIPT_KEY,
  push: {
    ios: [
      {
        pfx: __dirname + '/certs/BunchAppStorePushCertificate.p12',
        bundleId: 'com.flaremedia.bunch',
        production: true  // Prod
      },
      {
        pfx: __dirname + '/certs/BunchFlareMediaDevelopmentPushCertificate.p12',
        bundleId: 'com.flaremedia.bunch',  
        production: false // Dev
      },
      {
        pfx: __dirname + '/certs/Flare10e9DevelopmentRnDPushCertificate.p12',
        bundleId: 'co.10e9.flare-rnd',
        production: false // Dev
      },
      {
        pfx: __dirname + '/certs/Flare10e9DistributionRnDPushCertificate.p12',
        bundleId: 'co.10e9.flare-rnd',  
        production: true  // Prod
      }
    ]
  },
  facebookAppIds: [process.env.FACEBOOK_APP_ID],
  filesAdapter: new S3Adapter(
    process.env.S3_ACCESS_KEY,
    process.env.S3_SECRET_KEY,
    process.env.S3_BUCKET,
    {
      directAccess: true,
      baseUrl: process.env.S3_BASE_URL,
      globalCacheControl: 'public, max-age=172800'  // 48 hours in seconds
    }
  ),
  appName: process.env.APP_NAME,
  publicServerURL: process.env.SERVER_URL,
  // The email adapter
  emailAdapter: {
    module: 'parse-server-simple-mailgun-adapter',
    options: {
      // The address that your emails come from
      fromAddress: process.env.EMAIL_MAILGUN_FROM,
      // Your domain from mailgun.com
      domain: process.env.EMAIL_MAILGUN_DOMAIN,
      // Your API key from mailgun.com
      apiKey: process.env.EMAIL_MAILGUN_KEY
    }
  },
  revokeSessionOnPasswordReset: true,
  enableAnonymousUsers: false
});

// Serve the Parse API on the /parse URL prefix
app.use(process.env.PARSE_MOUNT || '/parse', api, function(req, res, next) {
  // This will get called after every parse request 
  // and stops the request propagation by doing nothing
  // See: https://github.com/ParsePlatform/parse-server/issues/2580
});

// Make the Parse Dashboard available
app.use('/dashboard', dashboard);

// Add the Opbeat middleware after regular middleware
if (typeof opbeat !== 'undefined') {
  app.use(opbeat.middleware.express());
}

// Custom error handling when in development mode
if (app.get('env') === 'development') {
  //Allow self-signed certs in dev
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  app.use(function(err, req, res, next) {
      res.status(err.status || 500);
      res.render('error', {
          message: err.message,
          error: err
      });
   });
}
// Production errors
else {
  // ...but before any other error handler
  app.use(function (err, req, res, next) {
    // Custom error handling goes here
    console.error(err);
    res.status(500).send();
  });
}

var port = process.env.PORT || 1337;
app.listen(port, function() {
    console.log('Parse server running! On port: ' + port + '.');
});
} // end cluster code
