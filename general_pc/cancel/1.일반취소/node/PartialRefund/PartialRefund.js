const express = require("express"); 
const PartialRefund = express();
const crypto = require('crypto'); 
const bodyParser = require("body-parser");
const request = require('request');

PartialRefund.use(bodyParser.json());
PartialRefund.use(bodyParser.urlencoded({extended : true}));

Date.prototype.YYYYMMDDHHMMSS = function () {
    var yyyy = this.getFullYear().toString();
    var MM = pad(this.getMonth() + 1,2);
    var dd = pad(this.getDate(), 2);
    var hh = pad(this.getHours(), 2);
    var mm = pad(this.getMinutes(), 2)
    var ss = pad(this.getSeconds(), 2)

    return yyyy +  MM + dd+  hh + mm + ss;
};

function pad(number, length) {
    var str = '' + number;
    while (str.length < length) {
      str = '0' + str;
    }
    return str;
}

var nowDate = new Date();
var HashMap = require ('hashmap');
    

//step1. 요청을 위한 파라미터 설정
const key = "ItEQKi3rY7uvDS8l";               // INIAPI Key
const mid = "INIpayTest";                     // 상점ID
const type = "partialRefund";
const timestamp = nowDate.YYYYMMDDHHMMSS();
const clientIp = "192.0.0.1";

const data = {
    tid : "StdpayCARDINIpayTest20231222110519706364",
    msg : "테스트 부분취소",
    price : "500",                           // 부분취소 요청금액
    confirmPrice : "0"                       // 부분취소 후 남은금액
};

// Hash Encryption
let plainTxt = key + mid + type + timestamp + JSON.stringify(data);
console.log("PLAINTXT : " + plainTxt)
plainTxt = plainTxt.replace(/\\/g, '');
const hashData = crypto.createHash('sha512').update(plainTxt).digest('hex');

console.log("HASHDATA : " + hashData);


//step2. API 요청/응답
const apiUrl = "https://iniapi.inicis.com/v2/pg/partialRefund"

let prams = {
    mid : mid,
    type : type,
    timestamp : timestamp,
    clientIp : clientIp, 
    data : data,
    hashData : hashData
}

let prams1 = JSON.stringify(prams)

let prams2 = prams1.replace(/\\/g, '');
console.log("REQUEST DATA : " + prams2);

request.post({ method: 'POST', uri: apiUrl, body: prams, json: true}, (err,httpResponse,body) =>{ 
    console.log("RESPONSE DATA :",body)
});