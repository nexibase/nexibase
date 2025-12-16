const express = require("express"); 
const vRefund = express();
const crypto = require('crypto'); 
const bodyParser = require("body-parser");
const request = require('request');


vRefund.use(bodyParser.json());
vRefund.use(bodyParser.urlencoded({extended : true}));

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

function AES_encrypt(str, apikey, ivKey) {
    const cipher = crypto.createCipheriv('aes-128-cbc', apikey, ivKey);
    let encryptedText = cipher.update(str, 'utf8', 'base64');
    encryptedText += cipher.final('base64');
    return encryptedText;
}
    
//step1. 요청을 위한 파라미터 설정
const key = "ItEQKi3rY7uvDS8l";  
const iv = "HYb3yQ4f65QL89==";		//INILiteKey	
const mid = "INIpayTest";  
const type = "refund";
const timestamp = nowDate.YYYYMMDDHHMMSS();
const clientIp = "111.222.333.889";

const refundAcctNum = "";
// AES Encryption
let enc_refundAcctNum = AES_encrypt(refundAcctNum, key, iv);

const data = {
    tid : "",
    msg : "가상계좌 전체환불 테스트",
    refundAcctNum : enc_refundAcctNum,
    refundBankCode : "88",
    refundAcctName : "홍길동"
};

// Hash Encryption
let plainTxt = key + mid + type + timestamp + JSON.stringify(data);
plainTxt = plainTxt.replace(/\\/g, ''); 
const hashData = crypto.createHash('sha512').update(plainTxt).digest('hex');

const apiUrl = "https://iniapi.inicis.com/v2/pg/refund/vacct"


let options1 = {
    mid : mid,
    type : type,
    timestamp : timestamp,
    clientIp : clientIp, 
    data : data,
    hashData : hashData
}

request.post({ method: 'POST', uri: apiUrl, body: options1, json: true}, (err,httpResponse,body) =>{ 
    console.log(body)
});

