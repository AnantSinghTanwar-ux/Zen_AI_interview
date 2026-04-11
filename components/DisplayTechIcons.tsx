import { cn, getTechLogos } from "@/lib/utils";
import { TechIconProps } from "@/types";
import Image from "next/image";
import React from "react";

async function DisplayTechIcons({ techStack }: TechIconProps) {
  const icons = await getTechLogos(techStack);
  return (
    <div className="flex">
      {icons?.slice(0, 3)?.map(({ tech, url }, idx) => {
        return (
          <div
            className={cn(
              "relative group bg-dark-300 rounded-full p-2  flex-center ring-2 ring-yellow-50/40",
              idx >= 1 && "-ml-3"
            )}
            key={tech}
          >
            <span className="tech-tooltip">{tech}</span>
            <Image
              src={url}
              alt={tech}
              width={100}
              height={100}
              className="size-5"
            />
          </div>
        );
      })}
    </div>
  );
}

export default DisplayTechIcons;
