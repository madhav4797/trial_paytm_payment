const mongoose = require("mongoose");
const config = require(__dirname+"/config.js");
const checksum_lib = require(__dirname+"/checksum.js");
const crypt = require(__dirname+"/crypt.js");
const http = require('http');
const https = require('https');
const qs = require('querystring');

module.exports.payment = function(app, reqx, resx, loggedInUser, no_of_hours, user_details, Account, account_data) {
  var amount;
  if (no_of_hours === "12") {
    amount = "20.00";
  } else if (no_of_hours === "24") {
    amount = "25.00";
  } else if (no_of_hours === "48") {
    amount = "35.00";
  }
  var params = {};
    params['MID'] = config.PaytmConfig.mid;
    params['WEBSITE'] = config.PaytmConfig.website;
    params['CHANNEL_ID'] = 'WEB';
    params['INDUSTRY_TYPE_ID'] = 'Retail';
    params['ORDER_ID'] = 'TEST_'  + new Date().getTime();
    params['CUST_ID'] = user_details.first_name;
    params['TXN_AMOUNT'] = amount;
    params['CALLBACK_URL'] = 'https://www.cheapflix.org/payment-callback';
    params['EMAIL'] = loggedInUser;
    params['MOBILE_NO'] = user_details.phone_number;


    checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {
      console.log(checksum);
      // var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
      var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production
      var form_fields = "";
      for (var x in params) {
        form_fields += "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
      }
      form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";
      resx.writeHead(200, { 'Content-Type': 'text/html' });
      resx.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' + txn_url + '" name="f1">' + form_fields + '</form><script type="text/javascript">document.f1.submit();</script></body></html>');
      resx.end();
    });


    app.post("/payment-callback", function(req, res){
      // Route for verifiying payment

  var body = '';

  req.on('data', function (data) {
     body += data;
  });

   req.on('end', function () {
     var html = "";
     var post_data = qs.parse(body);

     // received params in callback
     console.log('Callback Response: ', post_data, "\n");


     // verify the checksum
     var checksumhash = post_data.CHECKSUMHASH;
     // delete post_data.CHECKSUMHASH;
     var result = checksum_lib.verifychecksum(post_data, config.PaytmConfig.key, checksumhash);
     console.log("Checksum Result => ", result, "\n");


     // Send Server-to-Server request to verify Order Status
     var params = {"MID": config.PaytmConfig.mid, "ORDERID": post_data.ORDERID};

     checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {

       params.CHECKSUMHASH = checksum;
       post_data = 'JsonData='+JSON.stringify(params);

       var options = {
         // hostname: 'securegw-stage.paytm.in', // for staging
         hostname: 'securegw.paytm.in', // for production
         port: 443,
         path: '/merchant-status/getTxnStatus',
         method: 'POST',
         headers: {
           'Content-Type': 'application/x-www-form-urlencoded',
           'Content-Length': post_data.length
         }
       };


       // Set up the request
       var response = "";
       var post_req = https.request(options, function(post_res) {
         post_res.on('data', function (chunk) {
           response += chunk;
         });

         post_res.on('end', function(){
           console.log('S2S Response: ', response, "\n");

           var _result = JSON.parse(response);
             if(_result.STATUS == 'TXN_SUCCESS') {
                 res.send('payment sucess')
             }else {
                 res.send('payment failed')
             }
           });
       });

       // post the data
       post_req.write(post_data);
       post_req.end();
      });
     });
    });
}
