
import java.math.BigInteger;
import java.security.MessageDigest;

public class SHA512 {

	public String hash(String data_hash) {
		String salt = data_hash;
		String hex = null;

		try {
			MessageDigest msg = MessageDigest.getInstance("SHA-512");
			msg.update(salt.getBytes());
			hex = String.format("%0128x", new BigInteger(1, msg.digest()));
		} catch (Exception e) {
			e.printStackTrace();
		}
		
		return hex;
	}
}

