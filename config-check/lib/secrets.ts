import sodium from "libsodium-wrappers";

export async function encryptSecretForRepo(
  publicKeyBase64: string,
  secretValue: string
): Promise<string> {
  await sodium.ready;
  const binKey = sodium.from_base64(publicKeyBase64, sodium.base64_variants.ORIGINAL);
  const binSecret = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(binSecret, binKey);
  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}
