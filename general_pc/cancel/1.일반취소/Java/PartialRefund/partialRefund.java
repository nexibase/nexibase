
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.Map;

import org.json.simple.JSONObject;

public class partialRefund {

	public static void main(String[] args) throws Exception {

		SHA512 sha512 = new SHA512();
		Date date_now = new Date(System.currentTimeMillis());
		SimpleDateFormat fourteen_format = new SimpleDateFormat("yyyyMMddHHmmss");

		//step1. 요청을 위한 파라미터 설정						
		String key = "ItEQKi3rY7uvDS8l"; 											
		String mid = "INIpayTest";	
		String type = "partialRefund";
		String timestamp = fourteen_format.format(date_now);		
		String clientIp = "127.0.0.1";
		
		
		Map<String, Object> data1 = new HashMap<String, Object>();
	 	data1.put("tid", "");
	 	data1.put("msg", "부분취소 테스트");
	 	data1.put("price", "700");
	 	data1.put("confirmPrice", "300");
	 	data1.put("currency", "WON");
	 	data1.put("tax", "0");
	 	data1.put("taxfree", "0");
	 	
	 	JSONObject data = new JSONObject(data1);
	 	

		// Hash Encryption 
		String plainTxt = key + mid + type + timestamp + data ;
		plainTxt = plainTxt.replaceAll("\\\\", "");
		String hashData = sha512.hash(plainTxt);
		
		
		// reqeust URL
		String apiUrl = "https://iniapi.inicis.com/v2/pg/partialRefund";
		
		 JSONObject respJson = new JSONObject();
		    respJson.put("mid", mid);
		    respJson.put("type", type);
		    respJson.put("timestamp",timestamp);
		    respJson.put("clientIp",clientIp);
		    respJson.put("data",data);
		    respJson.put("hashData",hashData);
		   
		
		//step2. key=value 로 post 요청
		try {
			URL reqUrl = new URL(apiUrl);
			HttpURLConnection conn = (HttpURLConnection) reqUrl.openConnection();
			
			if (conn != null) {
				conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
				conn.setRequestMethod("POST");
				conn.setDefaultUseCaches(false);
				conn.setDoOutput(true);
				
				if (conn.getDoOutput()) {
					conn.getOutputStream().write(respJson.toString().getBytes("UTF-8"));
					conn.getOutputStream().flush();
					conn.getOutputStream().close();
				}

				conn.connect();
				
					BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
					
					//step3. 요청 결과
					System.out.println(br.readLine()); 
					br.close();
				}

		}catch(Exception e ) {
			e.printStackTrace();
		} 
	}
}

