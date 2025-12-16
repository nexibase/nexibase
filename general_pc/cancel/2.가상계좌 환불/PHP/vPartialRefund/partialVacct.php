<?php

header('Content-Type:text/html; charset=utf-8');


    //step1. 요청을 위한 파라미터 설정
    $key = "ItEQKi3rY7uvDS8l";
	$iv = "HYb3yQ4f65QL89==";
    $mid = "INIpayTest";
	$type = "partialRefund";
	$timestamp = date("YmdHis");
	$clientIp = "192.0.0.0";
	
	$refundAcctNum = "1002856123456"; //환불계좌번호
	$encData = base64_encode(openssl_encrypt($refundAcctNum, 'aes-128-cbc', $key, OPENSSL_RAW_DATA, $iv));

	$postdata = array();
	$postdata["mid"] = $mid;
	$postdata["type"] = $type;
    $postdata["timestamp"] = $timestamp;
	$postdata["clientIp"] = $clientIp;
	
	//// Data 상세
    $detail = array();
	$detail["tid"] = "StdpayVBNKINIpayTest20231012133902671264";
	$detail["msg"] = "테스트취소";
	$detail["price"] = "700";
	$detail["confirmPrice"] = "300";
	$detail["refundAcctNum"] = $encData;
	$detail["refundBankCode"] = "20";
	$detail["refundAcctName"] = "홍길동";
    
    $postdata["data"] = $detail;
	
	$details = str_replace('\\/', '/', json_encode($detail, JSON_UNESCAPED_UNICODE));
	
	//// Hash Encryption
	$plainTxt = $key.$mid.$type.$timestamp.$details;
    $hashData = hash("sha512", $plainTxt);
	
	$postdata["hashData"] = $hashData;
	
	echo "plainTxt : ".$plainTxt."<br/><br/>" ; 
	echo "hashData : ".$hashData."<br/><br/>" ; 
	
	
	$post_data = json_encode($postdata, JSON_UNESCAPED_UNICODE);
	
	echo "**** 요청전문 **** <br/>" ; 
	echo str_replace(',', ',<br>', $post_data)."<br/><br/>" ; 
	
	
	//step2. 요청전문 POST 전송
	
    $url = "https://iniapi.inicis.com/v2/pg/partialRefund/vacct";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json;charset=utf-8'));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
     
    $response = curl_exec($ch);
    curl_close($ch);
	
	
    //step3. 결과출력
	
	echo "**** 응답전문 **** <br/>" ;
	echo str_replace(',', ',<br>', $response)."<br><br>";
    
?>