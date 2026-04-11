import { Feedback, Interview } from "@/types";
import React from "react";
import dayjs from "dayjs";
import Image from "next/image";
import { getRandomInterviewCover } from "@/lib/utils";
import { Button } from "./ui/button";
import Link from "next/link";
import DisplayTechIcons from "./DisplayTechIcons";

function InterviewCard({
  id,
  //   userId,
  role,
  type,
  techstack,
  createdAt,
}: Interview) {
  const feedback = null as Feedback | null;
  const norrmalizedType = /mix/gi.test(type) ? "Mixed" : type;

  const formattedDate = dayjs(
    feedback?.createdAt || createdAt || Date.now()
  ).format("MMM D, YYYY");
  return (
    <div className="card-border w-[350px] max-sm:w-full min-h-96">
      <div className="card-interview">
        <div className="">
          <div className="absolute top-0 right-0 w-fit px-4 py-2 rounded-b-lg bg-light-600">
            <p className="badge-text ">{norrmalizedType}</p>
          </div>

          <Image
            src={getRandomInterviewCover()}
            alt="cover img"
            width={40}
            height={40}
            className="rounded-full object-fit"
          />

          <h3 className="mt-5 capitalize">{role} Interview</h3>

          <div className="flex  gap-5 mt-3">
            <div className="flex  gap-2">
              <Image
                src={"/calendar.svg"}
                alt="calender"
                width={22}
                height={22}
              />
              <p>{formattedDate}</p>
            </div>
            <div className="flex gap-2">
              <Image src={"/star.svg"} alt="star" width={22} height={22} />
              <p>{feedback?.totalScore || "---"}/100</p>
            </div>
          </div>
          <p className="line-clamp-2 mt-5">
            {feedback?.finalAssessment ||
              "You haven't taken Interview yet. Take it now to improve your skills."}
          </p>
        </div>
        <div className="flex justify-between">
          <DisplayTechIcons techStack={techstack} />

          <Button className="btn-primary">
            <Link
              href={feedback ? `/Interview/${id}/feedback` : `/Interview/${id}`}
            >
              {feedback ? "Check Feedback" : "View Interview"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InterviewCard;
