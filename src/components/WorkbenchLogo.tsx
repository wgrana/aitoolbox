import Image from "next/image";

type WorkbenchLogoProps = {
  size?: number;
  className?: string;
};

export function WorkbenchLogo({ size = 40, className }: WorkbenchLogoProps) {
  return (
    <Image
      src="/ai-pen-testing-workbench-logo.svg"
      width={size}
      height={size}
      alt="AI Pen Testing Workbench"
      priority
      className={className}
    />
  );
}
