import Image from "next/image";

type ChasmBankLogoProps = {
  size?: number;
  className?: string;
};

export function ChasmBankLogo({ size = 40, className }: ChasmBankLogoProps) {
  return (
    <Image
      src="/chasm-bank-logo.svg"
      width={size}
      height={size}
      alt="Chasm Bank"
      className={className}
    />
  );
}
