import { formatUnits } from "viem";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export const valueConvert = (
  input: string | undefined | bigint,
  decimal: number = 18
): string => {
  try {
    if (input === undefined) {
      return "0";
    }
    if (decimal === 0) {
      return input.toString();
    }

    return formatUnits(BigInt(input), decimal);
  } catch (error) {
    return Number(input).toString();
  }
};

function removeLeadingZeros(hexValue: string) {
  // Check if the hexValue is a valid hexadecimal number
  const hexRegex = /^0x[0-9A-Fa-f]+$/;
  // 0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI
  if (!hexRegex.test(hexValue)) {
    console.error("Invalid hex value");
    return hexValue;
  }

  // Remove leading zeros
  const cleanedHex = hexValue.replace("0x", "").replace(/^0+/, "");

  return "0x" + cleanedHex;
}

export function normalizedTokenAddress(ca: string) {
  const parts = ca.split("::");
  return [removeLeadingZeros(parts[0]), ...parts.slice(1)].join("::");
}
